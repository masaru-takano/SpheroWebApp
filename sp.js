var DEBUG = true;
var currentClientId;
var accessToken;

var timerId;
var spheroId;
var pebbleId;
var spheros = [];
var pebbles = [];

var moving = false;
var prevX;
var prevY;
var prevZ;

function init() {
    $('#btnConnect').on('click', function() {
        spheroId = $('[name=spheros] option:selected').val();
        pebbleId = $('[name=pebbles] option:selected').val();
        if (currentClientId === undefined || accessToken === undefined) {
            auth();
        } else {
            onAuth();
        }
    });
    $('#btnDisconnect').on('click', function() {
        stopSpehro();
        unregisterPebbleEvent();
        spheroId = undefined;
        pebbleId = undefined;
    });
    
    startPolling();
}

function auth() {
    var scopes = Array("deviceorientation", "drive_controller");
    dConnect.authorization('http://www.deviceconnect.org/demo/', scopes, 'サンプル',
        function(clientId, clientSecret, newAccessToken) {
            currentClientId = clientId;
            accessToken = newAccessToken;
            console.log("accessToken: " + accessToken);
            
            onAuth();
        },
        function(errorCode, errorMessage) {
            console.log("Failed to get accessToken.");
        });
}

function onAuth() {
    dConnect.connectWebSocket(currentClientId, function(errorCode, errorMessage) {
        console.log(errorMessage);
    });
    
    registerPebbleEvent();
}

function startPolling() {
    if (timerId !== undefined) {
        return;
    }
    timerId = setInterval(function() {
        dConnect.discoverDevices(
            function(status, headerMap, responseText) {
                var json = JSON.parse(responseText);
                if (json.result === 0) {
                    var devices = json.services;
                    var found = [];
                    found["sphero"] = [];
                    found["pebble"] = [];
                    for (var i = 0; i < devices.length; i++) {
                        var device = devices[i];
                        //console.log("Device: " + device.name);
                        if (device.name.match(/sphero/i)) {
                            found["sphero"].push(device);
                        } else if (device.name.match(/pebble/i)) {
                            found["pebble"].push(device);
                        }
                    }
                    
                    if (found["sphero"].length > 0) {
                        spheros = found["sphero"];
                        onFoundSphero(found["sphero"]);
                    }
                    if (found["pebble"].length > 0) {
                        pebbles = found["pebble"];
                        onFoundPebble(found["pebble"]);
                    }
                }
            },
            function(readyState, status) {
            });
    }, 1000);
}

function stopPolling() {
    if (timerId !== undefined) {
        clearInterval(timerId);
        timerId = undefined;
    }
}

function onFoundSphero(devices) {
    //console.log("onFoundSphero: " + devices.length);
    
    var select = $('#selectSphero');
    select.empty();
    for (var i = 0; i < devices.length; i++) {
        var option = $('<option>');
        option.attr("value", devices[i].id);
        option.html(devices[i].name);
        select.append(option);
    }
    select.selectmenu('refresh');
}

function onFoundPebble(devices) {
    //console.log("onFoundPebble: " + devices.length);
    
    var select = $('#selectPebble');
    select.empty();
    for (var i = 0; i < devices.length; i++) {
        var option = $('<option>');
        option.attr("value", devices[i].id);
        option.html(devices[i].name);
        select.append(option);
    }
    select.selectmenu('refresh');
}

function onDeviceOrientation(json) {
    //if (!spheroId) {
    //    return;
    //}
    var x = json.orientation.accelerationIncludingGravity.x;
    var y = json.orientation.accelerationIncludingGravity.y;
    var z = json.orientation.accelerationIncludingGravity.z;
    var sp = Math.sqrt(x * x + y * y) / 20;
    var angle = Math.atan2(x, y) / (Math.PI / 180);
    
    if (angle < 0) {
        angle += 360;
    }
    if (!moving) {
        if (prevX !== undefined && prevY !== undefined && prevZ !== undefined) {
            var dx = prevX - x;
            var dy = prevY - y;
            var dz = prevZ - z;
            var delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
            //console.log("delta: " + delta);
            moving = delta >= 8.0;
        }
    }
    if (moving) {
        console.log("move");
        moveSpehro(sp, Math.round(angle));
    }
    
    prevX = x;
    prevY = y;
    prevZ = z;
}

function moveSpehro(speed, angle) {
    if (spheroId === undefined) {
        return;
    }
    var builder = new dConnect.URIBuilder();
    builder.setProfile("drive_controller");
    builder.setAttribute("move");
    builder.setDeviceId(spheroId);
    builder.setAccessToken(accessToken);
    builder.addParameter("speed", speed);
    builder.addParameter("angle", angle);
    var uri = builder.build();
    dConnect.execute('POST', uri, null, null, function(status, headerMap, responseText) {
        var json = JSON.parse(responseText);
        if (json.result == 0) {
            
        } else {
            console.log(responseText);
        }
    }, function(xhr, textStatus, errorThrown) {
    });
}

function stopSpehro() {
    if (spheroId === undefined) {
        return;
    }
    moving = false;
    prevX = undefined;
    prevY = undefined;
    prevZ = undefined;
    
    var builder = new dConnect.URIBuilder();
    builder.setProfile("drive_controller");
    builder.setAttribute("stop");
    builder.setDeviceId(spheroId);
    builder.setAccessToken(accessToken);
    var uri = builder.build();
    dConnect.execute('DELETE', uri, null, null, function(status, headerMap, responseText) {
        var json = JSON.parse(responseText);
        if (json.result == 0) {
            
        } else {
            console.log(responseText);
        }
    }, function(xhr, textStatus, errorThrown) {
    });
}

function registerPebbleEvent() {
    if (pebbleId === undefined) {
        return;
    }
    var builder = new dConnect.URIBuilder();
    builder.setProfile("deviceorientation");
    builder.setAttribute("ondeviceorientation");
    builder.setDeviceId(pebbleId);
    builder.setAccessToken(accessToken);
    builder.setSessionKey(currentClientId);
    var uri = builder.build();
    if (DEBUG) console.log("Uri: " + uri);
    dConnect.addEventListener(uri, function(message) {
        // イベントメッセージが送られてくる
        //if (DEBUG) console.log("Event-Message: " + message);
        
        var json = JSON.parse(message);
        onDeviceOrientation(json);
    }, function() {
        console.log("Start to subscribe ondeviceorientation.");
    }, function(errorCode, errorMessage){
        console.log(errorMessage);
    });
}

function unregisterPebbleEvent() {
    if (pebbleId === undefined) {
        return;
    }
    var builder = new dConnect.URIBuilder();
    builder.setProfile("deviceorientation");
    builder.setAttribute("ondeviceorientation");
    builder.setDeviceId(pebbleId);
    builder.setAccessToken(accessToken);
    builder.setSessionKey(currentClientId);
    var uri = builder.build();
    if (DEBUG) console.log("Uri: " + uri);
    dConnect.removeEventListener(uri, function() {
        console.log("Stopped to subscribe ondeviceorientation.");
    }, function(errorCode, errorMessage){
        console.log(errorMessage);
    });
}