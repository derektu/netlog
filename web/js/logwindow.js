/**
 * Created by Derek on 2014/4/22.
 */
function LogWindow($, $log) {
    return {
        log : function(levelValue, level, msg){
            /* <p class="logline">
                <span class="level0">[debug] </span>
                <span class="logmsg">message goes here</span>
               </p>
             */

            var logline = $('<p>').attr('class', 'logline')
                    .append(
                        $('<span>').attr('class', 'level'+levelValue).append(level))
                    .append(
                        $('<span>').attr('class', 'logmsg').append(msg));

            $log.prepend(logline);
        },

        clear : function() {
            $log.empty();
        }

    };
}