import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { Script } from 'node:vm';
import { parse } from 'acorn';

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** Bundle static local ES modules, keeping each module's private scope intact.
 * Parsing declarations allows multiline imports without changing strings/comments.
 * Unsupported module syntax fails the build rather than breaking the output.
 */
export function bundle(entryPath) {
  const modules = new Map();
  const visiting = new Set();
  const factories = [];

  function visit(filePath) {
    const file = resolve(filePath);
    if (modules.has(file)) return modules.get(file);
    if (visiting.has(file)) throw new Error(`Circular module dependency: ${file}`);
    visiting.add(file);

    const source = readFileSync(file, 'utf8');
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const edits = [];
    const exports = new Map();

    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') {
        if (!node.source.value.startsWith('./') && !node.source.value.startsWith('../')) {
          throw new Error(`Only local imports are supported: ${node.source.value}`);
        }
        const dependency = visit(resolve(dirname(file), node.source.value));
        const bindings = node.specifiers.map((specifier) => {
          if (specifier.type !== 'ImportSpecifier') {
            throw new Error('Use named imports in application modules.');
          }
          const imported = specifier.imported.name;
          if (!dependency.exports.has(imported)) {
            throw new Error(`Missing export ${imported} in ${node.source.value}`);
          }
          return `${imported}: ${specifier.local.name}`;
        });
        edits.push({
          start: node.start,
          end: node.end,
          text: bindings.length
            ? `const { ${bindings.join(', ')} } = __modules[${dependency.id}];`
            : '',
        });
      } else if (node.type === 'ExportNamedDeclaration') {
        if (node.source) throw new Error('Re-exports are not supported.');
        if (node.declaration) {
          const declaration = node.declaration;
          const names =
            declaration.type === 'VariableDeclaration'
              ? declaration.declarations.map((item) => item.id)
              : [declaration.id];
          for (const name of names) {
            if (name?.type !== 'Identifier') throw new Error('Export a named declaration.');
            exports.set(name.name, name.name);
          }
          edits.push({ start: node.start, end: declaration.start, text: '' });
        } else {
          for (const specifier of node.specifiers) {
            exports.set(specifier.exported.name, specifier.local.name);
          }
          edits.push({ start: node.start, end: node.end, text: '' });
        }
      } else if (node.type.startsWith('Export')) {
        throw new Error('Use named exports in application modules.');
      }
    }

    let compiled = source;
    // Apply from the end so the parser's source offsets remain valid.
    for (const edit of edits.reverse()) {
      compiled = compiled.slice(0, edit.start) + edit.text + compiled.slice(edit.end);
    }
    const module = { id: factories.length, exports };
    const values = [...exports].map(([name, local]) => `${name}: ${local}`).join(', ');
    factories.push(`__modules[${module.id}] = (() => {\n${compiled}\nreturn { ${values} };\n})();`);
    modules.set(file, module);
    visiting.delete(file);
    return module;
  }

  const entry = visit(entryPath);
  const code = `(() => {\n'use strict';\nconst __modules = [];\n${factories.join('\n\n')}\nreturn __modules[${entry.id}];\n})()`;
  new Script(code);
  return code;
}

function insertOnce(template, marker, content) {
  if (template.split(marker).length !== 2) {
    throw new Error(`Expected exactly one ${marker} placeholder.`);
  }
  return template.replace(marker, () => content);
}

export function buildApplication(root = projectRoot) {
  const kernel = bundle(join(root, 'src', 'optics.js'));
  const worker = `const kernel = ${kernel};
self.onmessage = (event) => {
  const start = performance.now();
  try {
    self.postMessage({
      revision: event.data.revision,
      trace: kernel.traceScene(event.data.scene),
      ms: performance.now() - start,
    });
  } catch (error) {
    self.postMessage({ revision: event.data.revision, error: error.message });
  }
};`;
  const script = `(() => {\n'use strict';\nconst LUMEN_WORKER_SOURCE = ${JSON.stringify(worker)};\n${bundle(join(root, 'src', 'app.js'))};\n})();`;
  new Script(worker);
  new Script(script);
  const template = readFileSync(join(root, 'index.html'), 'utf8');
  const styles = readFileSync(join(root, 'src', 'styles.css'), 'utf8');
  const styled = insertOnce(template, '/*__STYLES__*/', styles);
  const html = insertOnce(styled, '/*__APP__*/', script.replace(/<\/script/gi, '<\\/script'));
  return { html, script, worker };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { html } = buildApplication();
  writeFileSync(join(projectRoot, 'lumen-3d-v3.html'), html);
  console.log(`Built ${Math.round(Buffer.byteLength(html) / 1024)} KB offline app.`);
}
