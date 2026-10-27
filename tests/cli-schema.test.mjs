import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
const cli=join(dirname(require.resolve('expo/package.json')),'node_modules/@expo/cli/build/src/start/server');
test('patched zod remains compatible with Expo developer tool schemas',()=>{
  const {PluginSchema,DevToolsPluginOutputSchema}=require(join(cli,'DevToolsPlugin.schema.js'));
  const {createMCPDevToolsExtensionSchema}=require(join(cli,'createMCPDevToolsExtensionSchema.js'));
  const plugin={packageName:'test-plugin',packageRoot:'/test',cliExtensions:{description:'Test',entryPoint:'index.js',commands:[{name:'check',title:'Check',environments:['cli'],parameters:[{name:'limit',type:'number'}]}]}};
  assert.equal(PluginSchema.parse(plugin).packageName,'test-plugin');
  assert.equal(DevToolsPluginOutputSchema.parse([{type:'text',text:'Ready',level:'info'}])[0].text,'Ready');
  assert.equal(createMCPDevToolsExtensionSchema(plugin).parse({command:'check',limit:1}).limit,1);
});
