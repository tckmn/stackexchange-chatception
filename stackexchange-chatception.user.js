// ==UserScript==
// @name Chatception
// @namespace http://keyboardfire.com/
// @author SE user Doorknob <andy@keyboardfire.com>
// @version 0.3
// @description A tiny widget that allows you to quickly chat in different Stack Exchange chatrooms from a single page.
// @grant none
// @copyright MIT
// @include *://chat.stackoverflow.com/*
// @include *://chat.stackexchange.com/*
// @include *://chat.meta.stackexchange.com/*
// ==/UserScript==

function chatception($) {

// this is taken from http://cdn-chat.sstatic.net/chat/Js/master-chat.js
var autoLink=function(){function e(e,s){if(e=t(e),e.length<s)return e;for(var n=e.length-1;n>0;n--)if("/"==e[n]&&s>n)return e.substring(0,n)+"/&hellip;";return e.substring(0,s-1)+"&hellip;"}function t(e){return e.replace(a,"")}function s(t){return'<a href="'+t.replace(r,"")+'">'+e(t,30)+"</a>"}function n(e,t,n){if(")"!==n.charAt(n.length-1))return t+s(n);for(var i=n.match(/[()]/g),a=0,o=0;o<i.length;o++)"("===i[o]?0>=a?a=1:a++:a--;var r="";if(0>a){var l=new RegExp("\\){1,"+-a+"}$");n=n.replace(l,function(e){return r=e,""})}return t+s(n)+r}var i=/([^">;]|^)\b((?:https?|ftp):\/\/[A-Za-z0-9][-A-Za-z0-9+&@#\/%?=~_|\[\]\(\)!:,.;]*[-A-Za-z0-9+&@#\/%=~_|\[\])])/gi,a=/^(https?|ftp):\/\/(www\.)?|(\/$)/gi,o="&zwnj;&#8203;",r=new RegExp(o,"g"),l=new RegExp($("<span>"+o+"</span>").text(),"g");return function(e){return e.replace(l,o).replace(i,n)}}();

// used for the [12345] display of unread messages
function addUnread(n, s) {
    if (n === 0) return s;
    var m;
    if (m = s.match(/^(?:\(\d*\*?\) )?\[(\d+)\]/)) {
        var newCount = +m[1] + n;
        return s.replace(/\[\d+\] /, newCount ? '[' + newCount + '] ' : '');
    } else if (m = s.match(/^\(\d*\*?\)/)) {
        return s.replace(/^(\(\d*\*?\))/, '$1 [' + n + ']');
    } else {
        return '[' + n + '] ' + s;
    }
}
function unreadCount(s) {
    return +(s.match(/^(?:\(\d*\*?\) )?\[(\d+)\]/) || [0,0])[1];
}

var MSG_LIST_WIDTH = 500,
    MSG_LIST_HEIGHT = 300,
    MSG_LIST_MAX = 100;

// add the popup box to each room in the sidebar
var roomsList = document.getElementById('my-rooms');
[].slice.apply(roomsList.getElementsByTagName('li')).forEach(initRoom);

function initRoom(room) {
    // the container for the messages (shown on hover)
    var msgWrapper = document.createElement('div');
    var msgList = document.createElement('table');
    msgList.className = 'msgList';
    msgList.style.width = '100%';
    msgWrapper.style.position = 'absolute';
    msgWrapper.style.top = '-' + (MSG_LIST_HEIGHT / 2) + 'px';
    msgWrapper.style.left = '-' + MSG_LIST_WIDTH + 'px';
    msgWrapper.style.width = MSG_LIST_WIDTH + 'px';
    msgWrapper.style.height = MSG_LIST_HEIGHT + 'px';
    msgWrapper.style.backgroundColor = 'white';
    msgWrapper.style.color = 'black';
    msgWrapper.style.border = '1px solid black';
    msgWrapper.style.zIndex = '999';
    msgWrapper.style.overflowY = 'auto';
    msgWrapper.style.display = 'none';
    msgWrapper.appendChild(msgList);
    room.appendChild(msgWrapper);

    // input box and button to send messages
    var sendMsg = function() {
        $.post('http://' + location.host + '/chats/' + room.id.slice(5) + '/messages/new', {
            text: sendInput.value,
            fkey: fkey().fkey
        });
        sendInput.value = '';
    };
    var sendMsgWidget = document.createElement('tr');
    // text field
    var sendInputTd = document.createElement('td');
    var sendInput = document.createElement('input');
    sendInput.className = 'sendInput';
    sendInput.style.width = '100%';
    sendInput.addEventListener('keyup', function(e) {
        if (e.keyCode === 13 /* enter */) sendMsg();
    });
    sendInputTd.style.width = '100%';
    sendInputTd.style.overflow = 'hidden';
    sendInputTd.style.paddingRight = '10px';
    sendInputTd.colSpan = 2;
    sendInputTd.appendChild(sendInput);
    sendMsgWidget.appendChild(sendInputTd);
    // button
    var sendButtonTd = document.createElement('td');
    var sendButton = document.createElement('button');
    sendButton.textContent = 'Send';
    sendButton.addEventListener('click', sendMsg);
    sendButtonTd.appendChild(sendButton);
    sendMsgWidget.appendChild(sendButtonTd);
    msgList.appendChild(sendMsgWidget);

    // add hooks to display the popup
    room.addEventListener('mouseenter', function() {
        msgWrapper.style.display = 'block';
        msgWrapper.scrollTop = msgWrapper.scrollHeight;
        // clear unread messages, if any
        var links = room.querySelectorAll('li>a');
        var rn = links[links.length-1];
        var unread = unreadCount(rn.textContent);
        rn.textContent = addUnread(-unread, rn.textContent);
        document.title = addUnread(-unread, document.title);
    });
    room.addEventListener('mouseleave', function() {
        msgWrapper.style.display = 'none';
    });

    // preload a few initial messages
    // (room.id is "room-12345", slice(5) removes "room-")
    getEvents(room.id.slice(5), function(x) { handleEvents(x, true); });
}

// add popup boxes to newly joined rooms
var observer = new MutationObserver(function(mutations) {
    [].slice.apply(roomsList.children).forEach(function(room) {
        if (room.getElementsByClassName('msgList').length === 0) initRoom(room);
    });
});
observer.observe(roomsList, { childList: true });

// set up websocket
var sock = getSock();
sock.onmessage = function(e) {
    var data = JSON.parse(e.data);
    handleEvents([].concat.apply([], Object.keys(data).map(function(k) {
        return data[k]['e'];
    })).filter(function(x) { return x; }));
}

function handleEvents(events, suppressUnread) {
    if (!events) return;

    events.forEach(function(msg) {
        var room = document.getElementById('room-' + msg['room_id']);
        var msgList = room ? room.getElementsByClassName('msgList')[0] : null;

        if (!msgList) return;

        if (msg['event_type'] === 1) { // MessagePosted
            var msgRow = document.createElement('tr');
            msgRow.style.height = 'auto';

            // username of the user who posted the message
            // also a popup menu for message actions (reply, edit, delete)
            var msgUser = document.createElement('td');
            msgUser.textContent = msg['user_name'];
            msgUser.style.padding = '5px';
            msgUser.style.maxWidth = Math.floor(MSG_LIST_WIDTH * 0.15) + 'px';
            msgUser.style.overflow = 'hidden';
            var msgActions = document.createElement('div');
            var me = CHAT.RoomUsers.current();

            if (msg['user_id'] != me.id) {
                // reply to message
                var actionReply = document.createElement('button');
                actionReply.textContent = 'reply';
                actionReply.addEventListener('click', function() {
                    var sendInput = msgList.getElementsByClassName('sendInput')[0];
                    sendInput.value = ':' + msg['message_id'] + ' ' + sendInput.value;
                    sendInput.focus();
                });
                msgActions.appendChild(actionReply);
            }

            if (msg['user_id'] == me.id || me.is_moderator) {
                // delete message
                var actionDelete = document.createElement('button');
                actionDelete.textContent = 'delete';
                actionDelete.addEventListener('click', function() {
                    $.post('http://' + location.host + '/messages/' + msg['message_id'] + '/delete', {
                        fkey: fkey().fkey
                    });
                });
                msgActions.appendChild(actionDelete);
                // edit message
                var actionEdit = document.createElement('button');
                actionEdit.textContent = 'edit';
                actionEdit.addEventListener('click', function() {
                    $.post('http://' + location.host + '/messages/' + msg['message_id'], {
                        fkey: fkey().fkey,
                        text: prompt('Edit to what?', msg['content'])
                    });
                });
                msgActions.appendChild(actionEdit);
            }

            msgActions.style.display = 'none';
            msgActions.style.position = 'absolute';
            msgActions.style.zIndex = '1000';
            // hook for popup
            msgUser.addEventListener('mouseenter', function() {
                msgActions.style.display = 'block';
            });
            msgUser.addEventListener('mouseleave', function() {
                msgActions.style.display = 'none';
            });
            msgUser.appendChild(msgActions);
            msgRow.appendChild(msgUser);

            // actual message content
            var msgContent = document.createElement('td');
            msgContent.innerHTML = msg['content'] === undefined ?
                '<em style="color:grey">(removed)</em>' :
                autoLink(msg['content'].replace(/^<pre([^>]*)>/, '<pre$1 style="white-space:pre-wrap">'));
            msgContent.id = 'chatception-msg' + msg['message_id'];
            msgContent.style.padding = '5px';
            msgContent.style.width = '100%';
            msgRow.appendChild(msgContent);

            // timestamp and permalink
            var msgDate = document.createElement('td');
            var msgDateLink = document.createElement('a');
            msgDateLink.href = 'http://' + location.host + '/transcript/message/' + msg['message_id'] + '#' + msg['message_id'];
            var d = new Date(msg['time_stamp'] * 1000);
            var days = Math.floor(new Date().getTime() / (3600*24*1000)) - Math.floor(d.getTime() / (3600*24*1000));
            if (days) {
                msgDateLink.textContent = days + 'd ago';
            } else {
                msgDateLink.textContent = d.getHours() + ':' +
                    (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
            }
            msgDate.style.padding = '5px';
            msgDate.appendChild(msgDateLink);
            msgRow.appendChild(msgDate);

            // add the message
            msgList.insertBefore(msgRow, msgList.lastChild);
            msgList.parentNode.scrollTop = msgList.parentNode.scrollHeight;

            // increment the "unread messages" counter
            if (!suppressUnread && room.lastChild.style.display === 'none') {
                var links = room.querySelectorAll('li>a');
                var rn = links[links.length-1];
                var unread = unreadCount(rn.textContent);
                rn.textContent = addUnread(1, rn.textContent);
                document.title = addUnread(1, document.title);
            }
        } else if (msg['event_type'] === 2) { // MessageEdited
            var msgContent = document.getElementById('chatception-msg' + msg['message_id']);
            if (msgContent) {
                msgContent.innerHTML = msg['content'];
            }
        } else if (msg['event_type'] === 10) { // MessageDeleted
            var msgContent = document.getElementById('chatception-msg' + msg['message_id']);
            if (msgContent) {
                msgContent.innerHTML = '<em style="color:grey">(removed)</em>';
            }
        }

        // remove excess messages
        while (msgList.children.length > MSG_LIST_MAX) {
            msgList.removeChild(msgList.firstChild);
        }
    });
};

// get the WebSocket object for chat. TODO: make this async.
function getSock() { return new WebSocket(JSON.parse($.ajax({type: 'POST', url: 'http://' + location.host + '/ws-auth', data: {roomid: CHAT.CURRENT_ROOM_ID, fkey: fkey().fkey}, async: false}).responseText)['url'] + '?l=' + JSON.parse($.ajax({type: 'POST', url: 'http://' + location.host + '/chats/' + CHAT.CURRENT_ROOM_ID + '/events', data: {fkey: fkey().fkey}, async: false}).responseText)['time']); }
// preload some previous messages (used when the page first loads)
function getEvents(roomid, callback) {
    $.ajax({
        type: 'POST',
        url: 'http://' + location.host + '/chats/' + roomid + '/events',
        data: {fkey: fkey().fkey, mode: 'Messages', msgCount: MSG_LIST_MAX-1, since: 0},
        success: function(data) { callback(data['events']); }
    });
}

}

// inject the code as a <script> element, because Safari doesn't seem to be
// using the page's jQuery properly
window.addEventListener('load', function() {
    var scriptEl = document.createElement('script');
    scriptEl.type = 'text/javascript';
    scriptEl.text = '(' + chatception + ')(jQuery);';
    document.head.appendChild(scriptEl);
});
