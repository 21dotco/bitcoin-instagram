
'use strict';

$(document).ready(function() {

    // Show buy command to the user on click.
    function showBuyCommand(e) {
        var t = e.target;
        while (t.nodeName !== 'LI') { t = t.parentNode }
        var id = t.getAttribute('data-id');
        var src = t.getElementsByTagName('IMG')[0].src;
        src = src.split('/');
        src = src[src.length - 1];
        // FIXME actually show a command to the user here.
        $('#theModal .command-line').html('python3 ~/instagram_client.py ' + id + ' ' + src + ' ' + location.protocol + '//' + location.host);
        $('#theModal').modal('show');
    }
    // Register event handler to show buy command on click.
    $('.entries li').on('click', showBuyCommand);

    // Select all content inside given node.
    function selectContent(t) {
        if (window.getSelection) {
            var currentRange;
            try {
              currentRange = window.getSelection().getRangeAt(0);
            } catch (err) {
              currentRange = document.createRange();
            }
            var range = document.createRange();
            window.getSelection().removeAllRanges();
            range.selectNodeContents(t);
            window.getSelection().addRange(range);
        } else if (document.selection) {
            var range = document.body.createTextRange();
            range.moveToElementText(t);
            range.select();
        }
    }
    // Select content inside given node on click
    function autoSelectListener(e) {
        var t = e.target;
        while (t.nodeName !== 'PRE') { t = t.parentNode; }
        selectContent(t);
    }
    // Register click event handler for auto-selecting code.
    $('#theModal .command-line').click(autoSelectListener);

    // Select command line contents and copy to cliboard.
    function copyToClipboard() {
        var node = $('#theModal .command-line').get(0);
        selectContent(node);
        document.execCommand('copy');
    }
    // Register click event handler for copying to cliboard.
    $('#theModal .copy-clipboard').click(copyToClipboard);

});

