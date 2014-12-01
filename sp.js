var DEBUG = true;
var currentClientId;
var accessToken;

var timerId;
var spheroId;
var spheros = [];
var defaultSpeed = 0.3;

function init() {
    spheroId = $('[name=spheros] option:selected').val();
    if (currentClientId === undefined || accessToken === undefined) {
        auth();
    } else {
        onAuth();
    }

    $('#btnStop').on('click', function() {
        stopSphero();
    });
    $('#btnForward').on('click', function() {
        moveSphero(defaultSpeed, 0);
    });
    $('#btnBack').on('click', function() {
        moveSphero(defaultSpeed, 180);
    });
    $('#btnLeft').on('click', function() {
        moveSphero(defaultSpeed, 270);
    });
    $('#btnRight').on('click', function() {
        moveSphero(defaultSpeed, 90);
    });

    startPolling();
}

function auth() {
    var scopes = Array("drive_controller");
    dConnect.authorization('http://www.deviceconnect.org/demo/', scopes, 'SpheroWebApp',
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
                    for (var i = 0; i < devices.length; i++) {
                        var device = devices[i];
                        //console.log("Device: " + device.name);
                        if (device.name.match(/sphero/i)) {
                            found["sphero"].push(device);
                        }
                    }
                    
                    if (found["sphero"].length > 0) {
                        spheros = found["sphero"];
                        onFoundSphero(found["sphero"]);
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
    spheroId = devices[0].id;
    
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

function moveSphero(speed, angle) {
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

function stopSphero() {
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
