// ==UserScript==
// @name Chatception
// @namespace http://keyboardfire.com/
// @version 0.1
// @description A tiny widget that allows you to quickly chat in different Stack Exchange chatrooms from a single page.
// @grant none
// @copyright MIT
// @match *://chat.stackoverflow.com/*
// @match *://chat.stackexchange.com/*
// @match *://chat.meta.stackexchange.com/*
// ==/UserScript==

window.onload = function() {

var MSG_LIST_WIDTH = 500,
    MSG_LIST_HEIGHT = 300,
    MSG_LIST_MAX = 50,
    MSG_LIST_MIN = 10, // TODO preload this many messages
    MSG_LIST_TIMEOUT = 5 * 60 * 1000;

var roomsList = document.getElementById('my-rooms');

[].slice.apply(roomsList.getElementsByTagName('li')).forEach(function(room) {
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
    sendInput.onkeyup = function(e) {
        if (e.keyCode === 13) {
            sendMsg();
        }
    };
    sendInputTd.style.width = '100%';
    sendInputTd.colSpan = 2;
    sendInputTd.appendChild(sendInput);
    sendMsgWidget.appendChild(sendInputTd);

    var sendButtonTd = document.createElement('td');
    var sendButton = document.createElement('button');
    sendButton.textContent = 'Send';
    sendButton.onclick = sendMsg;
    sendButtonTd.appendChild(sendButton);
    sendMsgWidget.appendChild(sendButtonTd);
    msgList.appendChild(sendMsgWidget);

    room.addEventListener('mouseenter', function() {
        msgWrapper.style.display = 'block';
    });
    room.addEventListener('mouseleave', function() {
        msgWrapper.style.display = 'none';
    });
});

var sock = getSock();
sock.onmessage = function(e) {
    var data = JSON.parse(e.data);
    var events = [].concat.apply([], Object.keys(data).map(function(k) {
        return data[k]['e'];
    })).filter(function(x) { return x; });
    if (!events) return;

    console.log(events);

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
            msgUser.style.cursor = 'pointer';
            msgUser.onclick = function() {
                var sendInput = msgList.getElementsByClassName('sendInput')[0];
                sendInput.value = ':' + msg['message_id'] + ' ' + sendInput.value;
                sendInput.focus();
            };
            msgUser.style.maxWidth = Math.floor(MSG_LIST_WIDTH * 0.15) + 'px';
            msgUser.style.overflow = 'hidden';
            msgRow.appendChild(msgUser);

            var msgContent = document.createElement('td');
            msgContent.innerHTML = msg['content'];
            msgContent.style.padding = '5px';
            msgContent.style.width = '100%';
            msgRow.appendChild(msgContent);

            var msgDate = document.createElement('td');
            var msgDateLink = document.createElement('a');
            msgDateLink.href = 'http://' + location.host + '/transcript/message/' + msg['message_id'] + '#' + msg['message_id'];
            var d = new Date(msg['time_stamp'] * 1000);
            msgDateLink.textContent = d.getHours() + ':' +
                (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
            msgDate.style.padding = '5px';
            msgDate.appendChild(msgDateLink);
            msgRow.appendChild(msgDate);

            msgList.insertBefore(msgRow, msgList.firstChild.nextSibling);
        }

        while (msgList.children.length > MSG_LIST_MAX ||
            (msgList.children.length > MSG_LIST_MIN &&
             new Date() - (+msgList.lastChild.getElementsByClassName('time')[0].textContent) > MSG_LIST_TIMEOUT)) {
            msgList.removeChild(msgList.lastChild);
        }
    });
};

function getSock() { return new WebSocket(JSON.parse($.ajax({type: 'POST', url: 'http://' + location.host + '/ws-auth', data: {roomid: CHAT.CURRENT_ROOM_ID, fkey: fkey().fkey}, async: false}).responseText)['url'] + '?l=' + JSON.parse($.ajax({type: 'POST', url: 'http://' + location.host + '/chats/' + CHAT.CURRENT_ROOM_ID + '/events', data: {fkey: fkey().fkey}, async: false}).responseText)['time']); }

}
