$(function(){
'use strict';

console.log("hello world");

// global in game settings 
var settings = {};

// all segments
var segments = {};

// really shitty parser. process line by line. can't really handle any bad input so
// better thread lightly when writing scripts.
function parse(text) {
    var lines = text.split(/\r?\n/);
    var state = "init";

    var pat_branch = /^\*([^\*]+)\*\s?(.+)$/;
    var pat_code_start = /^--\s*$/; 
    var pat_code_end   = /^--\s*$/; 
    var pat_marker = /^%%\s*(->)?\s*(\w+)$/;
    var pat_empty = /^\s*$/;
    for (var ix = 0; ix < lines.length; ++ix) {
        var line = lines[ix];
        var match;
        var segment;
        if (/^#/.test(line)) continue; // allow comments
        if (match = /^%\s*(\w+)$/.exec(line)) {
            state = 'bigsegment';
            var name = match[1]; 
            segment = segments[name] = [];
            segment.labels = {};
            continue;
        }

        // inside segment
        if (match = pat_branch.exec(line)) {
            // consume all branches
            var branches = [];
            var jx = ix;
            var next_line;
            do {
                branches.push({
                    type : 'branches',
                    pred : match[1],
                    text : match[2],
                });
                next_line = lines[++jx];
            } while (match = pat_branch.exec(next_line));
            ix = jx;
            segment.push(branches);
            continue;
        } else if (match = pat_code_start.test(line)) {
            // consume a code block
            var code_lines = [];
            var jx = ix + 1;
            while (pat_code_end.test(lines[jx]) === false) {
                code_lines.push(lines[jx++]);
                if (jx > lines.length) throw "unclosing code block";
            }
            segment.push({
                type : 'code',
                code : code_lines.join('\n'),
            });
            ix = jx; // skip code end line
            continue;
        } else if (match = pat_marker.exec(line)) {
            var label = {
                type : 'label',
                jump : match[1],
                name : match[2],
            };
            // populate label map
            if (!label.jump) {
                segment.labels[label.name] = label;
            }
            segment.push(label);
            continue;
        } else if (!pat_empty.test(line)){
            // group text lines together for fancy printing
            var group = {
                type : 'text',
                lines : [],
            };
            var jx = ix;
            do {
                group.lines.push(lines[jx++]);
            } while (!pat_empty.test(lines[jx]));
            segment.push(group);
            ix = jx; // skip to next non empty line
            continue;
        }
    }
}

var $content = $('#content');
$.get('intro.txt', function(response){
    parse(response);
    console.log('-------');
    console.log(segments);
})


// debug expose to global
window.segments = segments;
window.settings = settings;

})

