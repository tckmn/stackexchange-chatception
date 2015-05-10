// ==UserScript==
// @name Chatception
// @namespace http://keyboardfire.com/
// @version 0.2
// @description A tiny widget that allows you to quickly chat in different Stack Exchange chatrooms from a single page.
// @grant none
// @copyright MIT
// @match *://chat.stackoverflow.com/*
// @match *://chat.stackexchange.com/*
// @match *://chat.meta.stackexchange.com/*
// ==/UserScript==

window.addEventListener('load', function() {

var MSG_LIST_WIDTH = 500,
    MSG_LIST_HEIGHT = 300,
    MSG_LIST_MAX = 100;

var roomsList = document.getElementById('my-rooms');

[].slice.apply(roomsList.getElementsByTagName('li')).forEach(initRoom);

function initRoom(room) {
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

    var sendMsg = function() {
        $.post('http://' + location.host + '/chats/' + room.id.slice(5) + '/messages/new', {
            text: sendInput.value,
            fkey: fkey().fkey
        });
        sendInput.value = '';
    };

    var sendMsgWidget = document.createElement('tr');
    var sendInputTd = document.createElement('td');
    var sendInput = document.createElement('input');
    sendInput.className = 'sendInput';
    sendInput.style.width = '100%';
    sendInput.addEventListener('keyup', function(e) {
        if (e.keyCode === 13) {
            sendMsg();
        }
    });
    sendInputTd.style.width = '100%';
    sendInputTd.colSpan = 2;
    sendInputTd.appendChild(sendInput);
    sendMsgWidget.appendChild(sendInputTd);

    var sendButtonTd = document.createElement('td');
    var sendButton = document.createElement('button');
    sendButton.textContent = 'Send';
    sendButton.addEventListener('click', sendMsg);
    sendButtonTd.appendChild(sendButton);
    sendMsgWidget.appendChild(sendButtonTd);
    msgList.appendChild(sendMsgWidget);

    room.addEventListener('mouseenter', function() {
        msgWrapper.style.display = 'block';
        msgWrapper.scrollTop = msgWrapper.scrollHeight;
    });
    room.addEventListener('mouseleave', function() {
        msgWrapper.style.display = 'none';
    });

    handleEvents(getEvents(room.id.slice(5)));
}

var observer = new MutationObserver(function(mutations) {
    [].slice.apply(roomsList.children).forEach(function(room) {
        if (room.children.length < 4) initRoom(room);
    });
});
observer.observe(roomsList, {
    childList: true
});

var sock = getSock();
sock.onmessage = function(e) {
    var data = JSON.parse(e.data);
    handleEvents([].concat.apply([], Object.keys(data).map(function(k) {
        return data[k]['e'];
    })).filter(function(x) { return x; }));
}

function handleEvents(events) {
    if (!events) return;

    events.forEach(function(msg) {
        var room = document.getElementById('room-' + msg['room_id']);
        var msgList = room ? room.getElementsByClassName('msgList')[0] : null;

        if (!msgList) return;

        if (msg['event_type'] === 1) {
            var msgRow = document.createElement('tr');
            msgRow.style.height = 'auto';

            var msgUser = document.createElement('td');
            msgUser.textContent = msg['user_name'];
            msgUser.style.padding = '5px';
            msgUser.style.maxWidth = Math.floor(MSG_LIST_WIDTH * 0.15) + 'px';
            msgUser.style.overflow = 'hidden';
            var msgActions = document.createElement('div');
            var actionReply = document.createElement('button');
            actionReply.textContent = 'reply';
            actionReply.addEventListener('click', function() {
                var sendInput = msgList.getElementsByClassName('sendInput')[0];
                sendInput.value = ':' + msg['message_id'] + ' ' + sendInput.value;
                sendInput.focus();
            });
            msgActions.appendChild(actionReply);
            var actionDelete = document.createElement('button');
            actionDelete.textContent = 'delete';
            actionDelete.addEventListener('click', function() {
                $.post('http://' + location.host + '/messages/' + msg['message_id'] + '/delete', {
                    fkey: fkey().fkey
                });
            });
            msgActions.appendChild(actionDelete);
            var actionEdit = document.createElement('button');
            actionEdit.textContent = 'edit';
            actionEdit.addEventListener('click', function() {
                $.post('http://' + location.host + '/messages/' + msg['message_id'], {
                    fkey: fkey().fkey,
                    text: prompt('Edit to what?', msg['content'])
                });
            });
            msgActions.appendChild(actionEdit);
            msgActions.style.display = 'none';
            msgActions.style.position = 'absolute';
            msgActions.style.zIndex = '1000';
            msgUser.addEventListener('mouseenter', function() {
                msgActions.style.display = 'block';
            });
            msgUser.addEventListener('mouseleave', function() {
                msgActions.style.display = 'none';
            });
            msgUser.appendChild(msgActions);
            msgRow.appendChild(msgUser);

            var msgContent = document.createElement('td');
            msgContent.innerHTML = msg['content'] === undefined ?
                '<em style="color:grey">(removed)</em>' : msg['content'];
            msgContent.id = 'chatception-msg' + msg['message_id'];
            msgContent.style.padding = '5px';
            msgContent.style.width = '100%';
            msgRow.appendChild(msgContent);

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
            msgDate.className = 'timestamp';
            msgDate.setAttribute('data-timestamp', (+d) / 1000);
            msgDate.style.padding = '5px';
            msgDate.appendChild(msgDateLink);
            msgRow.appendChild(msgDate);

            msgList.insertBefore(msgRow, msgList.lastChild);
            msgList.parentNode.scrollTop = msgList.parentNode.scrollHeight;
        } else if (msg['event_type'] === 2) {
            var msgContent = document.getElementById('chatception-msg' + msg['message_id']);
            if (msgContent) {
                msgContent.innerHTML = msg['content'];
            }
        } else if (msg['event_type'] === 10) {
            var msgContent = document.getElementById('chatception-msg' + msg['message_id']);
            if (msgContent) {
                msgContent.innerHTML = '<em style="color:grey">(removed)</em>';
            }
        }

        while (msgList.children.length > MSG_LIST_MAX) {
            msgList.removeChild(msgList.lastChild);
        }
    });
};

function getSock() { return new WebSocket(JSON.parse($.ajax({type: 'POST', url: 'http://' + location.host + '/ws-auth', data: {roomid: CHAT.CURRENT_ROOM_ID, fkey: fkey().fkey}, async: false}).responseText)['url'] + '?l=' + JSON.parse($.ajax({type: 'POST', url: 'http://' + location.host + '/chats/' + CHAT.CURRENT_ROOM_ID + '/events', data: {fkey: fkey().fkey}, async: false}).responseText)['time']); }
function getEvents(roomid) { return JSON.parse($.ajax({type: 'POST', url: 'http://' + location.host + '/chats/' + roomid + '/events', data: {fkey: fkey().fkey, mode: 'Messages', msgCount: 10, since: 0}, async: false}).responseText)['events']; }

});
