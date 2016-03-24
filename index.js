#! /usr/bin/env node
var ajv = require('ajv')({
        allErrors: true,
        jsonPointers: true
    }),
    YAML = require('yaml-js'),
    src = process.argv[2],
    file = require('fs').readFileSync(src).toString(),
    swaggerSchema = require('./oai-schema.json'),
    doc = YAML.load(file),
    ast = YAML.compose(file);

function positionRangeForPath(path) {

    var invalidRange = {
            start: { line: 0, column: 0 },
            end:   { line: 0, column: 0 }
        },
        i = 0;

    function find(current) {
        var pair, key, value, item;
        if (current.tag === 'tag:yaml.org,2002:map') {
            for (i = 0; i < current.value.length; i += 1) {
                pair = current.value[i];
                key = pair[0];
                value = pair[1];
                if (key.value === path[0]) {
                    path.shift();
                    return find(value);
                }
            }
        }
        if (current.tag === 'tag:yaml.org,2002:seq') {
            item = current.value[path[0]];

            if (item && item.tag) {
                path.shift();
                return find(item);
            }
        }

        if (path.length) { return invalidRange; }
        return {
            start: {
                line: current.start_mark.line,
                column: current.start_mark.column
            },
            end: {
                line: current.end_mark.line,
                column: current.end_mark.column
            }
        };
    }
    return find(ast);
}
function parseError(errors) {
    errors = errors.reverse();
    return errors.map(function (error) {
        var w = error.dataPath.replace('/', '').split('/');
        w = w.map(function (k) { return k.replace(/\~1/g, '/'); });
        w = positionRangeForPath(w);
        w.message = error.message;
        return w.message
            + ' in ' + src
            + ' on line ' + (w.start.line + 1)
            + ', column ' + w.start.column;
    });
}

if (file.match(/^swagger:/m)) {
    ajv.validate(swaggerSchema, doc);
} else {
    ajv.validate(require('./hyper-schema.json'), doc);
    //ajv.validateSchema(doc);
}
if (ajv.errors) { console.log(parseError(ajv.errors).join('\n')); }
