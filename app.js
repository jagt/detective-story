$(function(){
'use strict';

console.log("hello world");

// global constants
var constants = {
    usual_print : 1,
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
    choice : null, // last choice result
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

    var pat_seg = /^%\s*(.+)$/;
    var pat_branch = /^\*([^\*]+)\*\s?(.+)$/;
    var pat_code_start = /^--\s*$/; 
    var pat_code_end   = /^--\s*$/; 
    var pat_marker = /^%%\s*(->)?\s*(\w+)$/;
    var pat_empty = /^\s*$/;
    for (var ix = 0; ix < lines.length; ++ix) {
        var line = lines[ix];
        var match;
        var segment;
        if (/^#/.test(line)) continue; // seems only allow top level comments
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
                    pred : match[1],
                    text : match[2],
                });
                next_line = lines[++jx];
                if (jx > lines.length) throw "unclosing text block";
            } while (match = pat_branch.exec(next_line));
            ix = jx;
            segment.push({
                type : 'branches',
                cases : branches,
            });
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
                if (jx > lines.length) throw "unclosing text block";
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
                    $text.append('<br/>');
                    // peek if next block is a branch block
                    var next = get_next();
                    if (next && next.type == 'branches') {
                        next_block()
                    } else {
                        state.status = 'idle';
                        $triangle.show();
                    }
                    return;
                }
                var interval = state.print_interval;
                if (char_ix < line.length) {
                    var c = line[char_ix++];
                    if (c == ' ') {
                        c = '&nbsp;';
                    }
                    $text.append(c);
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
        branches : function(branches) {
            var $ul = $('<ul class="branches"></ul>').appendTo($main);
            state.status = 'branching'
            $.each(branches.cases, function(ix, branch){
                if (branch.pred == '?' || eval(branch.pred)) {
                    $('<li></li>').data('branch_index', ix)
                                  .html("<span>"+branch.text+"</span>").appendTo($ul);
                }
            });
            $('li', $ul).one('click', function(e){
                state.choice = parseInt( $(this).data('branch_index') );
                clean_main();
                next_block();
            });
        },
        code : function(code) {
            var control = new function() {
                var self = this;
                this.to_label = function(label) {
                    self.next_label = label;
                };
                this.jump_to = function(segname) {
                    self.next_seg = segname;
                }
                // extra functions
                this.clean_main = clean_main;
                this.reset = function() {
                    settings = {}; // need to clean up the settings.
                    self.jump_to('intro');
                };
            };
            eval(code.code);
            // handle the outcome
            if (control.next_seg) {
                state.seg = segments[control.next_seg];
                if (!state.seg) throw "invalid segment jump:" + control.next_seg;
                // jumping into label in another segment
                if (control.next_label) {
                    var next = state.seg.labels[control.next_label]
                    if (!next)
                        throw "invalid seg+label jump:" + control.next_seg + ":" + control.next_label;
                    next_block(next);
                } else {
                    next_block(state.seg[0]);
                }
                return;
            } else if (control.next_label) {
                var next = state.seg.labels[control.next_label];
                if (!next) throw "invalid lable jump:" + control.next_label;
                next_block(next);
            } else {
                next_block();
            }
        },
        label : function(label) {
            if (label.jump) {
                var next = state.seg.labels[label.name];
                if (!next) throw "invalid jump label:" + label.name;
                next_block(next);
            } else {
                next_block();
            }
        }

    };

    function clean_main() {
        $main.empty();
    }

    function handle_block() {
        console.log("doing block:")
        console.log(state.block);
        handlers[state.block.type](state.block);
    }

    function get_next() {
        var block_in_seg = state.seg.indexOf(state.block);
        return state.seg[block_in_seg+1];
    }

    function next_block(block) {
        state.block = block || get_next();

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


// zepto don't have ajax chains builtin...
$.get('scripts/intro.txt', function(intro_txt){
$.get('scripts/programmer.txt', function(programmer_txt){
    parse(intro_txt);
    parse(programmer_txt);
    evaluator();
})
})


// expose to global
window.segments = segments;
window.settings = settings;
window.state = state;

})

