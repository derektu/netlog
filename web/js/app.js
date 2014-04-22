/**
 * Created by Derek on 2014/4/4.
 */
var app = (function($){
    var logger = new Logger($('#debuglog'), true);
    var logwindow = new Logger($('#log'), false);
    var socket = null;
    var refAppID = '';
    var refLogID = '';

    start = function() {
        logger.log('app is init');

        initLevelDropdown();

        initAppIDAndLogID();

        $('#btn_reflog').click(function(e) {
            refLog();
        });

        $('#btn_clearlogwindow').click(function(e) {
            logwindow.clear();
        });

        socket = initSocket();
    };

    function initAppIDAndLogID() {
        $('#appid_reload').click(function(e) {
            reloadAppID();
        });

        $('#logid_reload').click(function(e) {
            reloadLogID(null);
        });

        // now kick off the first reload
        //
        reloadAppID();
    }

    function reloadAppID() {
        $.ajax({
            url: "/api/appIDs",
            timeout: 30 * 1000,
            dataType: "json",
            success: function (data) {
                logger.log('appIDList=' + data);
                initAppIDDropdown(data);
            },
            error: function (xhr, status, error) {
                logger.log('error=' + error);
            }
        });
    }

    function reloadLogID(appID) {
        appID = appID || $('#appid_value').data("cmd");
        logger.log('reloadLogID based on appID=' + appID);
        if (appID != "") {
            $.ajax({
                url: "/api/" + appID + "/logIDs",
                timeout: 30 * 1000,
                dataType: "json",
                success: function (data) {
                    logger.log('logIDList=' + data);
                    initLogIDDropdown(data);
                },
                error: function (xhr, status, error) {
                    logger.log('error=' + error);
                }
            });
        }
    }

    function refLog() {
        var appID = $('#appid_value').data("cmd") || '';
        var logID = $('#logid_value').data("cmd") || '';

        if (appID == "" || logID == "")
            return;

        refAppID = appID;
        refLogID = logID;

        logwindow.clear();

        // send ref packet (appID, logID, count)
        // 目前count先寫死, 以後再提供UI來調整.
        //  - TODO: 是否pass level ?
        //
        socket.emit('ref', { appID: refAppID, logID: refLogID, count: 100});

        logger.log('add ref: appID=' + refAppID + ' logID=' + refLogID);
    }

    function initDropdown(idList, $value, $dropdown, onValueChange) {
        // 把$dropdown底下的<li>都移除
        //  except '#' 開頭的<li>
        //
        $dropdown.find('li a').each(function() {
            var anchor = $(this);
            if (String(anchor.data('cmd')).indexOf('#') == -1) {
                anchor.parent().remove();
            }
        });

        // 把idList一個一個加進去
        //
        var count = idList.length, i;
        for (i = count - 1 ; i >= 0; i--) {
            var id = idList[i];
            /*
             <li><a href="#" data-cmd="id">ID</a></li>
             */
            var li = $('<li>').append(
                $('<a>').attr('href', '#').attr('data-cmd', id).append(id));

            li.find('a').click(function() {
                var selection = $(this).parents(".btn-group").find('.selection');
                selection.text($(this).text());
                selection.data("cmd", $(this).data("cmd"));

                // trigger onValudChange
                //
                if (onValueChange != null)
                    onValueChange($(this).data("cmd"));
            });

            $dropdown.prepend(li);
        }

        // 調整button的appID
        //
        var cmd = $value.data("cmd");
        var candidate = count > 0 ? idList[0] : "";
        if (candidate == "") {
            $value.data("cmd", "");
            $value.text("[ None ]");
        }
        else {
            $value.data("cmd", candidate);
            $value.text(candidate);

            // trigger onValudChange
            //
            if (onValueChange != null)
                onValueChange(candidate);
        }
    }

    function initAppIDDropdown(appIDList) {
        initDropdown(appIDList, $('#appid_value'), $('#appid_dropdown'), function(appID) {
            reloadLogID(appID);
        });
    }

    function initLogIDDropdown(logIDList) {
        initDropdown(logIDList, $('#logid_value'), $('#logid_dropdown'), null);
    }

    function initLevelDropdown() {
        $("#level-dropdown li a").click(function(){
            var selection = $(this).parents(".btn-group").find('.selection');
            selection.text($(this).text());
            selection.data("cmd", $(this).data("cmd"));
            logger.log('set selection cmd:' + selection.data("cmd"));
        });
    }

    function initSocket() {
        var socket = io.connect();

        socket.on('connect', function() {
            logger.log('socket is connected');
        });

        socket.on('logReady', function(logs) {
            var i = 0; count = logs.length;
            for ( ; i < count; i++) {
                logwindow.log(JSON.stringify(logs[i]));
            }
        });

        return socket;
    }

    return {
        start: start
    };

})(jQuery);


jQuery(document).ready(function() {
    app.start();
});

