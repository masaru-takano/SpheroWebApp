var Timer = function() {
    this.time = 0;
    this.delay = 1000;
    this.timerId;
};
Timer.prototype.start = function() {
    var self = this;
    this.timerId = setInterval(function() {
        self.time += self.delay;
        self.onchange(self.time);
    }, this.delay);
    self.onstart();
    return this;
};
Timer.prototype.onchange = function(time) {};
Timer.prototype.onstart = function() {};
Timer.prototype.onstop = function() {};
Timer.prototype.stop = function() {
    if (this.timerId !== undefined) {
        clearInterval(this.timerId);
        this.timerId = undefined;
        this.time = 0;
        this.onstop();
    }
    return this;
};

var DEBUG = true;
var ip;
var currentClientId;
var accessToken;
var isRecording = false;
var deviceId;
var timer = new Timer();

function init() {
    timer.onchange = function(time) {
        displayTime(time);
    };
    timer.onstart = function() {
        displayTime(0);
    };

    // IPアドレス設定
    ip = getIpString();
    dConnect.setHost(ip);
    
    displayTime(0);
    $('#btnMain').on('click', function() {
        isRecording = !isRecording;
        if (isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
        var name = isRecording ? "Stop" : "Record";
        $('#btnMain').val(name);
        $('#btnMain').button("refresh");
    });
    
    // 認証
    auth();
}

function displayTime(time) {
    var hour = 0;
        var minute = 0;
        var second = 0;;
        while (time > 1000 * 60 * 60) {
            time -= 1000 * 60 * 60;
            hour++;
        }
        while (time > 1000 * 60) {
            time -= 1000 * 60;
            minute++;
        }
        while (time > 1000) {
            time -= 1000;
            second++;
        }
        var display = "";
        if (hour < 10) {
            display += "0";
        }
        display += hour + ":";
        if (minute < 10) {
            display += "0";
        }
        display += minute + ":";
        if (second < 10) {
            display += "0";
        }
        display += second;
        $('#time').html(display);
}

function auth() {
    dConnect.setHost(ip);
    var scopes = Array("mediastream_recording", "media_player");
        dConnect.authorization('http://www.deviceconnect.org/demo/', scopes, 'サンプル',
            function(clientId, clientSecret, newAccessToken) {
                currentClientId = clientId;
                accessToken = newAccessToken;
                console.log("accessToken: " + accessToken);
                document.cookie = 'accessToken' + ip + '=' + accessToken;
                
                onauth();
            },
            function(errorCode, errorMessage) {
                console.log("Failed to get accessToken.");
            });
}

function onauth() {
    dConnect.discoverDevices(
                    function(status, headerMap, responseText) {
                        var json = JSON.parse(responseText);
                        
                        for (var i = 0; i < json.services.length; i++) {
                            var device = json.services[i];
                            if (device.name.indexOf("Host") !== -1) {
                                deviceId = device.id;
                                break;
                            }
                        }
                        if (deviceId === undefined) {
                            console.log("iOS Host device was not found.");
                        } else {
                            console.log("Device ID: " + deviceId);
                            dConnect.connectWebSocket(currentClientId, function(errorCode, errorMessage) {
                                console.log(errorMessage);
                            });
                            ondevice();
                        }
                    },
                    function(readyState, status) {
                        console.log("HTTP " + status);
                    });
}

function ondevice() {
    addEventListener();
    //showMediaList();
}

function onStartRecording() {
    timer.start();

    $('#play').button('disable');
    $('#play').button('refresh');
}

function onStoppingRecording() {
    timer.stop();
}

function onFinishRecording(medium) {
    $('#play').data('medium', medium);
    $('#play').on('click', function() {
        putMedium($(this).data('medium'));
    });
    $('#play').button('enable');
    $('#play').button('refresh');
}

function showMediaList() {
    var builder = new dConnect.URIBuilder();
    builder.setProfile("media_player");
    builder.setAttribute("media_list");
    builder.setDeviceId(deviceId);
    builder.setAccessToken(accessToken);
    var uri = builder.build();
    if (DEBUG) console.log("Uri: " + uri);

    dConnect.execute('GET', uri, null, null, function(status, headerMap, responseText) {
        var json = JSON.parse(responseText);
        if (json.result === 0) {
            $('#media_list').empty();
            for (var i = 0; i < json.media.length; i++) {
                var medium = json.media[i];
                
                var b = $('<input type="button" />');
                b.val(medium.title);
                b.data('medium', medium);
                b.on('click', function() {
                    putMedium($(this).data('medium'));
                });
                $('#media_list').append(b);
                $('#media_list').append('<br>');
            }
        } else {
            console.log(json.errorMessage);
        }
    }, function(xhr, textStatus, errorThrown) {
        console.log(textStatus);
    });
}

function searchMedia(mediaId) {
    var builder = new dConnect.URIBuilder();
    builder.setProfile("media_player");
    builder.setAttribute("media_list");
    builder.setDeviceId(deviceId);
    builder.setAccessToken(accessToken);
    var uri = builder.build();
    if (DEBUG) console.log("Uri: " + uri);

    dConnect.execute('GET', uri, null, null, function(status, headerMap, responseText) {
        var json = JSON.parse(responseText);
        if (json.result === 0) {
            for (var i = 0; i < json.media.length; i++) {
                var medium = json.media[i];
                console.log("medium: id=" + medium.mediaId + " title=" + medium.title);
                if (mediaId === medium.mediaId) {
                    onFinishRecording(medium);
                    break;
                }
            }
        } else {
            console.log(json.errorMessage);
        }
    }, function(xhr, textStatus, errorThrown) {
        console.log(textStatus);
    });
}

function putMedium(medium) {
    var builder = new dConnect.URIBuilder();
    builder.setProfile("media_player");
    builder.setAttribute("media");
    builder.setDeviceId(deviceId);
    builder.setAccessToken(accessToken);
    builder.addParameter("mediaId", medium.mediaId);
    var uri = builder.build();
    if (DEBUG) console.log("Uri: " + uri);
    
    dConnect.execute('PUT', uri, null, null, function(status, headerMap, responseText) {
        var json = JSON.parse(responseText);
        if (json.result === 0) {
            playMedium();
        } else {
            console.log(json.errorMessage);
        }
    }, function(xhr, textStatus, errorThrown) {
        console.log(textStatus);
    });
}

function playMedium() {
    var builder = new dConnect.URIBuilder();
    builder.setProfile("media_player");
    builder.setAttribute("play");
    builder.setDeviceId(deviceId);
    builder.setAccessToken(accessToken);
    var uri = builder.build();
    if (DEBUG) console.log("Uri: " + uri);
    
    dConnect.execute('PUT', uri, null, null, function(status, headerMap, responseText) {
        var json = JSON.parse(responseText);
        if (json.result === 0) {
            console.log("playMedium");
        } else {
            console.log(json.errorMessage);
        }
    }, function(xhr, textStatus, errorThrown) {
        console.log(textStatus);
    });
}

function addEventListener() {
    var builder = new dConnect.URIBuilder();
    builder.setProfile("mediastream_recording");
    builder.setAttribute("onrecordingchange");
    builder.setDeviceId(deviceId);
    builder.setAccessToken(accessToken);
    builder.setSessionKey(currentClientId);
    var uri = builder.build();
    if (DEBUG) console.log("Uri: " + uri);
    
    dConnect.addEventListener(uri, function(message) {
        // イベントメッセージが送られてくる
        if (DEBUG) console.log("Event-Message: " + message);
        
        var json = JSON.parse(message);
        if (json.media.status === "stop"){
            searchMedia(json.media.path);
        }
    }, function() {
        console.log("Start to subscribe onrecordingchange.");
    }, function(errorCode, errorMessage){
        console.log(errorMessage);
    });
}

function startRecording() {
    onStartRecording();

    var builder = new dConnect.URIBuilder();
    builder.setProfile("mediastream_recording");
    builder.setAttribute("record");
    builder.setDeviceId(deviceId);
    builder.setAccessToken(accessToken);
    builder.addParameter("target", "audio");
    var uri = builder.build();
    if (DEBUG) console.log("Uri: " + uri);
    
    dConnect.execute('POST', uri, null, null, function(status, headerMap, responseText) {
        var json = JSON.parse(responseText);
        if (json.result === 0) {
            console.log("Started to record.");
        } else {
            console.log(json.errorMessage);
        }
    }, function(xhr, textStatus, errorThrown) {
        console.log(textStatus);
    });
}

function stopRecording() {
    onStoppingRecording();

    var builder = new dConnect.URIBuilder();
    builder.setProfile("mediastream_recording");
    builder.setAttribute("stop");
    builder.setDeviceId(deviceId);
    builder.setAccessToken(accessToken);
    builder.addParameter("target", "audio");
    var uri = builder.build();
    if (DEBUG) console.log("Uri: " + uri);
    
    dConnect.execute('PUT', uri, null, null, function(status, headerMap, responseText) {
        var json = JSON.parse(responseText);
        if (json.result === 0) {
            console.log("Stopped to record.");
        } else {
            console.log(json.errorMessage);
        }
    }, function(xhr, textStatus, errorThrown) {
        console.log(textStatus);
    });
}

/**
 * リモートアクセスする端末のIPアドレス指定を取得する.
 */
function getIpString() {
    if (1 < document.location.search.length) {
        var query = document.location.search.substring(1);
        var parameters = query.split('&');
        for (var i = 0; i < parameters.length; i++) {
            var element = parameters[i].split('=');
            var paramName = decodeURIComponent(element[0]);
            var paramValue = decodeURIComponent(element[1]);
            if (paramName == "ip") {
                return paramValue;
            }
        }
    }
    return "localhost";
}

/**
 * Cookieに保存していた値を取得する.
 *
 * @param {String} name Cookie名
 */
function getCookie(name) {
    var result = null;
    var cookieName = name + '=';
    var allcookies = document.cookie;
    var position = allcookies.indexOf(cookieName);
    if (position != -1) {
        var startIndex = position + cookieName.length;
        var endIndex = allcookies.indexOf(';', startIndex);
        if (endIndex == -1) {
            endIndex = allcookies.length;
        }
        result = decodeURIComponent(allcookies.substring(startIndex, endIndex));
    }
    return result;
}
