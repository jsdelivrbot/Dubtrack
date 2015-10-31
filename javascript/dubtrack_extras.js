// Variables
var DTE_API = { // TODO
    init: function() {

    },
    session: { name: undefined, id: undefined, logged: false },
    currentSong: { name: undefined, dj: undefined }
}
var session = { name: undefined, id: undefined }, activeDJ;
var volSpan, lastVolume, volUpdate = false;
var chatEl, chatOptions = { join: false, leave: false, updub: true, downdub: true, songChange: true }, chatSeparationOnSongChange = true;
var totalDubs, localUpdubs = 0, localDowndubs = 0;
var lastUpdubLog = null, lastDowndubLog = null, lastUpdubLogTotal = 0, lastDowndubLogTotal = 0, lastUpdubList = [], lastDowndubList = []
var lastSongId = null;

var updateInterval = setInterval(function() {
    // Volume update
    if(!volUpdate) {
        volUpdate = true;
        return;
    }
    if(volSpan !== undefined)
        volSpan.attr("class", volumeClass());

    var vol = parseInt(getVolume());
    if((vol + '%') !== $('.volume-percentage').text())
        $('.volume-percentage').text(vol + '%');
}, 100);

function volumeBtn() {
    var isZero = getVolume() === 0;
    if(!isZero) lastVolume = getVolume();

    var newVol = (isZero ? lastVolume : 0);
    $("#volume-div div").css("width", newVol + '%');
    $("#volume-div a").css("left", newVol + '%');
    Dubtrack.room.player.setVolume(newVol);
    Dubtrack.helpers.cookie.set('dubtrack-room-volume', newVol);

    volSpan.attr("class", volumeClass());
    volUpdate = false;
}

function volumeClass() {
    var v = getVolume();

    if(v > 50) return "icon-volume-up";
    else if(v > 0) return "icon-volume-down";
    else return "icon-volume-off";
}

function getVolume() { // 0 - 100
    var vol = $("#volume-div div").outerWidth(), volL = $("#volume-div").outerWidth();
    return vol / volL * 100;
}

function constructTotalDubsTitle() {
    var result = "";
    if(localUpdubs > 0) result += '+';
    result += localUpdubs + " updub";
    if(localUpdubs !== 1) result += 's';
    result += " | ";
    if(localDowndubs > 0) result += '-';
    result += localDowndubs + " downdub";
    if(localDowndubs !== 1) result += 's';
    return result;
}

function updateLastDub() {
    lastUpdubLog = null;
    lastDowndubLog = null;
    lastUpdubLogTotal = 0;
    lastDowndubLogTotal = 0;
}

function showUsersWhoDubed(chatEl, updub) {
    var wasHidden = chatEl.children("#all-usernames").css("display") === 'none';
    chatEl.children("#all-usernames").css("display", wasHidden ? 'initial' : 'none');
    if(wasHidden) chatEl.children(".chat-plus-users").text(' [hide]');
    else chatEl.children(".chat-plus-users").text('+' + chatEl.children(".chat-plus-users").attr('val') + ' [show]');
}

function getUserById(id) {
    var byId = Dubtrack.room.users.collection.findWhere({userid: id});
    return byId;
}

var dte_lastUserCount = -1;
var dte_init = setInterval(function() {
    if(typeof(Dubtrack) === 'undefined') return;
    if(!Dubtrack.room.chat) return;
    if(!Dubtrack.room.users) return;
    else {
        if(Dubtrack.room.users.collection.length !== dte_lastUserCount) {
            dte_lastUserCount = Dubtrack.room.users.collection.length;
            return;
        }
    }

    clearInterval(dte_init);

    setTimeout(function() {
        if(Dubtrack.loggedIn) {
            session.name = Dubtrack.session.get('username');
            session.id = Dubtrack.session.attributes.userInfo.userid;
        }

        chatEl = $("section#chat  .chat-container .chat-messages.ps-container .chat-main");

        totalDubs = $("#maindubtotal.dubstotal");
        if(Dubtrack.room.player && Dubtrack.room.player.activeSong.get('song')) {
            activeDJ = getUserById(Dubtrack.room.player.activeSong.get('song').userid);
            localUpdubs = Dubtrack.room.player.activeSong.attributes.song.updubs;
            localDowndubs = Dubtrack.room.player.activeSong.attributes.song.downdub;
        } else {
            if(parseInt(totalDubs.text()) < 0) localDowndubs = parseInt(totalDubs.text());
            else localUpdubs = parseInt(totalDubs.text());
        }
        totalDubs.attr("title", constructTotalDubsTitle);

        Dubtrack.Events.bind('realtime:room_playlist-dub', function(data) {
            var songAttr = Dubtrack.room.player.activeSong.attributes,
                userid = data.user.userInfo.userid;
            var isUpdub = data.dubtype === 'updub',
                isCurrentUser = userid === session.id,
                isUserDJ = songAttr === undefined ? false : (songAttr.song.userid === session.id);
            var chatLogUser = '<a href="#" class="username user-' + userid + '" style="display: initial;" onclick="Dubtrack.helpers.displayUser(\'' + userid + '\', this);" class="cursor-pointer">@' + (isCurrentUser ? 'you' : data.user.username) + '</a>',
                chatLogHTML = '<li class="chat-system-notification notification-' + data.dubtype + '">' + chatLogUser + ' <span id="all-usernames" style="display: none;"></span><span class="chat-plus-users cursor-pointer" style="display: initial;" onclick="showUsersWhoDubed($(this).parent());"></span> <span class="chat-' + data.dubtype + 'ed">' + data.dubtype + 'ed</span> <span title="' + (songAttr === undefined ? $(".currentSong").text() : ('[' + songAttr.songInfo.name + ']'   + 'played by [' + activeDJ.get('_user').username + ']'  )) + '">' + (isUserDJ ? 'your' : 'this') + ' track</span></li>';

            var _localDubs = isUpdub ? localUpdubs : localDowndubs,
                _lastDubLog = isUpdub ? lastUpdubLog : lastDowndubLog,
                _lastDubLogTotal = isUpdub ? lastUpdubLogTotal : lastDowndubLogTotal,
                _lastDubList = isUpdub ? lastUpdubList : lastDowndubList,
                _lastContDubList = isUpdub ? lastDowndubList : lastUpdubList,
                displayInChat = isUpdub ? chatOptions.updub : chatOptions.downdub;

            _localDubs++;

            if(_lastContDubList.indexOf(userid) > -1)
                _lastContDubList.splice(_lastContDubList.indexOf(userid), 1);
            else _lastDubList.push(userid);
            if(displayInChat) {
                try {
                    if(_lastDubLog === null) {
                        _lastDubLog = $(chatLogHTML).appendTo(chatEl);
                        Dubtrack.room.chat.lastItemEl = null;
                    } else {
                        _lastDubLogTotal++;
                        _lastDubLog.children("#all-usernames").html(_lastDubLog.children("#all-usernames").html().replace(' and', ','));
                        _lastDubLog.children("#all-usernames").append(' and ' + chatLogUser);
                        if(_lastDubLog.children(".chat-plus-users").css('display') !== 'none') {
                            _lastDubLog.children(".chat-plus-users").text('+' + _lastDubLogTotal + ' [show]');
                            _lastDubLog.children(".chat-plus-users").attr('val', _lastDubLogTotal);
                        }
                    }
                } catch(e) { // ? D:
                    _lastDubLog = $(chatLogHTML).appendTo(chatEl);
                    Dubtrack.room.chat.lastItemEl = null;
                }
            }

            if(isUpdub) {
                lastUpdubLog = _lastDubLog;
                lastUpdubLogTotal = _lastDubLogTotal;
                lastUpdubList = _lastDubList;
                lastDowndubList = _lastContDubList;
            } else {
                lastDowndubLog = _lastDubLog;
                lastDowndubLogTotal = _lastDubLogTotal;
                lastDowndubList = _lastDubList;
                lastUpdubList = _lastContDubList;
            }

            localUpdubs = songAttr.song.updubs;
            localDowndubs = songAttr.song.downdubs;

            //console.log(data.user.username + " -> " + data.dubtype + "ed.");
            $(".dubstotal").attr("title", constructTotalDubsTitle);
        });

        function setCssClasses(itemEl) {
            if(itemEl.prop('tagName').toLowerCase() !== 'li' || itemEl.attr('class').substring(0, 'user-'.length) !== 'user-') return;
            var user = Dubtrack.room.users.collection.findWhere({userid: itemEl.attr('class').split(/-| /)[1]});
            itemEl.addClass('username-' + user.get('_user').username);
            var role = !user.get('roleid') ? 'none' : Dubtrack.helpers.isDubtrackAdmin(user.get('userid')) ? 'admin' : user.get('roleid').type;
            itemEl.addClass('role-' + role.replace('-', ''));
        }

        for(var i = 0; i < chatEl.children().length; i++) { setCssClasses($(chatEl.children()[i])); }
        chatEl.on('DOMNodeInserted', function(e) { setCssClasses($(e.target)); });

        Dubtrack.Events.bind('realtime:user-join', function(data) {
            if(data.user.userInfo.userid === session.id) return;

            //console.log(data.user.username + " -> joined the room");
            if(chatOptions.join)
                chat.append('<li class="chat-system-notification notification-user_leave"><a href="#" class="username user-' + data.user.userInfo.userid + '">@' + data.user.username + '</a> joined the room.</li>');
        });

        Dubtrack.Events.bind('realtime:user-leave', function(data) {
            if(data.user._id === session.id) return;

            //console.log(data.user.username + " -> left the room");
            if(chatOptions.leave)
                chat.append('<li class="chat-system-notification notification-user_join"><a href="#" class="username user-' + data.user.userInfo.userid + '">@' + data.user.username + '</a> left the room.</li>');
        });

        Dubtrack.Events.bind('realtime:room_playlist-update', function(data) {
            updateLastDub();
            localUpdubs = 0;
            localDowndubs = 0;
            $("#player-controller ul li.add-to-playlist a").removeClass('grabbed');
            if(totalDubs !== null) totalDubs.attr("title", constructTotalDubsTitle);

            var activeSong = Dubtrack.room.player.activeSong;
            activeDJ = getUserById(activeSong.get('song').userid);
            if(lastSongId === activeSong.get('song').songid) return;
            else lastSongId = activeSong.get('song').songid;
            var chatLogStr = '<li class="chat-system-notification notification-song_change" ' + (chatSeparationOnSongChange ? 'style="border-top: 2px solid #5a5b5c ;"' : '') + '>Now Playing <span class="chat-current-song-name">' + data.songInfo.name + '</span>'   + '. Current DJ is <span class="chat-current-song-dj">' + activeDJ.get('_user').username + '</span>'  + '</li>';
            var chatLogHTML = $(chatLogStr).appendTo(chatEl);
            Dubtrack.room.chat.lastItemEl = null;
        });

        $("head").append([
            '<style id="dte-stylesheet">',
            '/* Volume Button */',
            '#player-controller ul li.remove-if-iframe.display-block',
            '{ border-right: 0; }',

            'li.volume-button a span.icon-volume-down:before',
            '{ padding-right: 5.5px; }',

            'li.volume-button a span.icon-volume-off:before',
            '{ padding-right: 9.6094px; }',

            '.noanim.volume.remove-if-iframe.display-block',
            '{ border-right-width: 0; }',

            '.volume-button,.pointer-no-select',
            '{ cursor:pointer; -webkit-user-select:none; user-select:none; -moz-user-select:none; -ms-user-select:none; }',

            '/* Chat Notifications */',
            '.chat-system-notification',
            '{ text-align: center; text-transform: uppercase; padding: .5em !important; font-size: .75em; color: #5a5b5c; font-weight: 700; }',

            '/* Chat Dub Log */',
            '.chat-updubed,.chat-current-song-dj',
            '{ color: cyan; }',

            '.chat-downdubed,.chat-current-song-name',
            '{ color: #FF0080; }',

            '.chat-plus-users',
            '{ top: -.5em; color: white; position: relative; font-size: .8em; }',

            '.chat-plus-users:hover',
            '{ color: #8A8A8A; }',

            '/* Chat Song Change Log */',
            '.chat-current-song-dj',
            '{ color: cyan; }',

            '.chat-current-song-name',
            '{ color: magenta; }',

            '/* Grab Fix */',
            '#player-controller ul li.add-to-playlist a.grabbed',
            '{ background-color: #FF00FF; }',

            '/* Volume Percentage */',
            '.volume-percentage',
            '{ position: absolute;  width: 85px; top: -3px; text-align: center; font-size: .75em; font-weight: bold; z-index: -1; }',
            '</style>'].join(''));

        var addToPlaylistEl = $('#player-controller ul li.add-to-playlist a');
        addToPlaylistEl.click(function() {
            var nodeinserted = function(e) {
                var containerLisEl = $('#addToPlaylistFloatContainer .playlist-list-action.ps-container li');
                if(containerLisEl.length > 0) {
                    containerLisEl.click(function() { addToPlaylistEl.addClass('grabbed'); });
                    $('body').unbind('DOMNodeInserted', nodeinserted);
                }
            }
            $('body').bind('DOMNodeInserted', nodeinserted);
        });

        var volPercentage = $('<span class="volume-percentage">' + parseInt(getVolume()) + '%</span>').insertBefore('#player-controller .left ul .volume #volume-div');
        $('#player-controller .left ul .volume').after('<li class="volume-button"><a onclick="volumeBtn()"><span></span></a></li>');

        volSpan = $(".volume-button a span");
        lastVolume = getVolume();
        if(lastVolume === 0) lastVolume = 50;
        volUpdate = true;

        console.log('Dubtrack Extras -> INIT');
    }, 1000);
}, 100);