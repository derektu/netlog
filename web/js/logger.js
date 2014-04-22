/**
 * Created by Derek on 2014/4/4.
 */
function Logger($log, addtime) {
    return {
        getTime : function() {
            var now = new Date();
            var hour = now.getHours();
            var min = now.getMinutes();
            var sec = now.getSeconds();

            if (min <= 9) {
                min = "0" + min;
            }
            if (sec <= 9) {
                sec = "0" + sec;
            }
            if (hour <= 9) {
                hour = "0" + hour;
            }

            return hour + ':' + min + ':' + sec;
        },

        log : function(msg){
            if (addtime)
                $log.prepend('[' + this.getTime() + '] ' + msg + "<br/>");
            else
                $log.prepend(msg + "<br/>");
        },

        clear : function() {
            $log.empty();
        }
    };
};
