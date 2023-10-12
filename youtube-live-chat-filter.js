// ==UserScript==
// @name         YouTube live chat filter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  This script allows you to apply custom filters on live chat messages and redirect them to special popup window
// @author       asethone
// @match        https://www.youtube.com/live_chat*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict'

    console.log('Script was started');
    // Data
    let isActive = false;       // is message tracking active
    let viewWindow = null;      // view popup window
    let msgList = document.querySelector('#chat #items');
    // Button colors
    const statusColor = { false: '#3e3e3e', true: '#ea3322' };
    // Append button to header
    let chatHeader = document.querySelector("yt-live-chat-header-renderer");
    let button = document.createElement('button');
    button.style.padding = '10px';
    button.style.marginRight = '5px';
    button.style.borderRadius = '10px';
    button.style.backgroundColor = statusColor[isActive];
    button.style.border = 'none';
    chatHeader.insertBefore(button, document.querySelector("#live-chat-header-context-menu"));
    // Create popup function
    const createPopup = function () {
        // Calculate screen dimensions
        const windowInitWidth = 600;
        const windowInitHeight = Math.floor(window.screen.height * 0.8);
        // Open popup
        viewWindow = window.open('', 'View', `popup=yes,width=${windowInitWidth},height=${windowInitHeight}`);
        viewWindow.document.title = 'View';
        const style = viewWindow.document.createElement('style');
        style.textContent = `
            body {
                background-color: #0f0f0f;
                color: #ffffff;
            }

            p {
                margin: 0;
                overflow-wrap: break-word;
            }

            #list {
                width: 100%;
                min-width: 400px;
                max-width: 800px;
                margin: 0 auto;
            }

            #list>div {
                display: flex;
                flex-direction: row;
                align-items: center;
                font-family: Roboto, Arial, sans-serif;
                font-size: 20px;
                margin-bottom: 8px;
                padding: 5px;
                background-color: #ffffff1a;
                border-radius: 5px;
            }

            #list img {
                width: 30px;
                height: 30px;
                border-radius: 30px;
                margin-right: 10px;
            }

            #list .author {
                min-width: 120px;
                width: 20%;
                margin-right: 10px;
                color: #9a9a9a;
            }

            #list .message {
                width: 85%;
                color: #e8e8e8;
            }

            #list button {
                display: block;
                width: 30px;
                height: 30px;
                border: none;
                background-color: #ffffff25;
                border-radius: 5px;
                color: #e8e8e8;
            }

            #list button:hover {
                background-color: #ff0000;
            }
        `;
        viewWindow.document.head.appendChild(style);
        viewWindow.document.body.innerHTML = '<div id="list"></div>';
        const script = viewWindow.document.createElement('script');
        script.textContent = `
            function addMessage(imgSrc, author, message) {
                const list = document.getElementById('list');
                const div = document.createElement('div');
                const img = document.createElement('img');
                img.setAttribute('src', imgSrc);
                const pAuthor = document.createElement('p');
                pAuthor.textContent = author;
                pAuthor.className = 'author';
                const pMessage = document.createElement('p');
                pMessage.textContent = message;
                pMessage.className = 'message';
                const btn = document.createElement('button');
                btn.textContent = '✕';
                btn.onclick = () => { div.remove() };
                div.appendChild(img);
                div.appendChild(pAuthor);
                div.appendChild(pMessage);
                div.appendChild(btn);
                list.appendChild(div);
            }

            function setOnCloseCallback(fn) {
                window.onbeforeunload = () => fn();
            }
        `;
        viewWindow.document.body.appendChild(script);
        // Set popup's onclose callback
        viewWindow.setOnCloseCallback(() => {
            updateStatus(false);
            viewWindow = null;
        });
    }
    // Scrap chat messages
    const onAppend = function (appendedNode) {
        // TODO: убрать проверку и вызывать только когда isActive
        if (viewWindow) {
            // timeout just in case images src are not yet loaded correctly
            setTimeout(() => {
                const msg = {
                    imgSrc: appendedNode.querySelector('#img').getAttribute('src'),
                    author: appendedNode.querySelector('#author-name').textContent,
                    message: (() => {
                        const elMsg = appendedNode.querySelector('#message');
                        let strMsg = '';
                        for (const node of elMsg.childNodes) {
                            if (node.nodeType === Node.TEXT_NODE) {
                                strMsg += node.textContent;
                            } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
                                let emoji = node.getAttribute('alt');
                                if (emoji)
                                    strMsg += emoji;
                            }
                        }
                        return strMsg;
                    })()
                };
                viewWindow.addMessage(msg.imgSrc, msg.author, msg.message);
            }, 100);
        }
    };
    // Mutation callback
    const callback = function (mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                onAppend(node);
            }
        }
    };
    // Create observer to watch for new chat messages
    let observer = new MutationObserver(callback);
    // Toggle status function
    function updateStatus(status) {
        isActive = status;
        button.style.backgroundColor = statusColor[isActive];
        console.log('Status: ' + (isActive ? 'active' : 'non active'));
        if (isActive) {
            if (!viewWindow)
                createPopup();
            observer.observe(msgList, { childList: true });
        } else {
            observer.disconnect();
        }
    };
    // Set button onclick handler
    button.onclick = () => {
        updateStatus(!isActive);
    };
    // Set main window's onclose handler
    window.onclose = () => {
        if (viewWindow)
            viewWindow.close();
    };
    // Monkey patching window.open
    const stdWinOpen = window.open;
    window.open = function () {
        const win = stdWinOpen.apply(this, arguments);
        const onPopupLoad = () => {
            if (win.location.href.match(/.*live_chat\?is_popout.*/)) {
                // chat was opened by user in new window
                updateStatus(false);
            }
            removeEventListener('load', onPopupLoad);
        };
        win.addEventListener('load', onPopupLoad);

        return win;
    };
})();