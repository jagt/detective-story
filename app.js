$(function(){
'use strict';

console.log("hello world");

// global constants
var constants = {
    usual_print : 50,
};

// global in game settings 
var settings = {};

// all segments
var segments = {};

// global game state
var state = {
    status : 'idle',
    block : null, // current executing block
    seg : null, // current segment
    print_interval : constants.usual_print,

};

// dom
var $content = $('#content');
var $main = $('#main');
var $triangle = $('#triangle');

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


// evaluator, handle io and print text as they go
function evaluator() {
    state.seg = segments['intro']; // starting from intro
    var block_ix = 0;

    // use global state to synchronize
    var handlers = {
        text : function(text) {
            var $text = $('<p></p>').appendTo($main);
            var timeoutid;
            var line_ix = 0;
            var char_ix = 0;
            state.status = 'printing';
            $triangle.hide();
            var text_printer = function() {
                var line = text.lines[line_ix];
                if (!line) {
                    clearTimeout(timeoutid);
                    $text.append('<br/><br/>');
                    state.status = 'idle';
                    $triangle.show();
                    return;
                }
                var interval = state.print_interval;
                if (char_ix < line.length) {
                    $text.append(line[char_ix++]);
                } else {
                    $text.append('<br/>');
                    line_ix += 1;
                    char_ix = 0;
                    interval *= 5; // stop a little bit longer on new line
                }
                timeoutid = setTimeout(text_printer, interval);
            }
            timeoutid = setTimeout(text_printer, state.print_interval);
        },
    };

    function handle_block() {
        handlers[state.block.type](state.block);
    }

    function next_block() {
        var block_in_seg = state.seg.indexOf(state.block);
        state.block = state.seg[block_in_seg+1];

        // necessary resets
        state.print_interval = constants.usual_print;
        handle_block();
    }

    function global_click_callback(e) {
        if (state.status == 'idle') {
            next_block();
        } else if (state.status == 'printing') {
            state.print_interval /= 5;
        }
        return false;
    }
    $(document).on('click', global_click_callback);

    // kick off
    state.block = state.seg[0];
    handle_block();
}


$.get('intro.txt', function(response){
    parse(response);
    console.log('-------');
    console.log(segments);

    evaluator();
})


// expose to global
window.segments = segments;
window.settings = settings;
window.state = state;

})

