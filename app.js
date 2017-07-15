// Requires
var Discord = require('discord.js');
var isset = require('isset');

// Application
var App = {
    token: '<Discord Bot Token>',

    // Discord
    client: {},

    // Dynamic Channel Name
    DynamicChannelName: {
        enabled: true,
        channelPrefix: '~ ',                    // Only process channels with this prefix
        defaultChannelName: 'Room',             // Default channel name
        defaultChannelNameEmpty: 'Room',        // Default empty channel name
        minPresenceDominanceProcentage: 51,     // Minimum procentage condition before changing channel name
        minParticipant: 0,                       // Minimum of participant in a channel before changing channel name
    },

    // Run
    run: function(options, callback) {

        // Construct App.client
        App.client = new Discord.Client();

        // Login using token
        App.client.login(App.token);

        // Client ready
        App.client.on('ready', function() {
            console.log('Logged in as ' + App.client.user.tag);

            // Set App.client information
            App.client.user.setGame('God');

            // Run callback
            if (typeof callback == "function") {
                callback(options);
            }
        });

        /*
         * Presence Event
         */
        App.client.on('presenceUpdate', function(statusBefore, statusAfter) {

            App.handleDynamicChannelName(App.client, statusAfter);
        });

        /*
         * Voice
         */
         App.client.on('voiceStateUpdate', function(VoiceChannel, User) {

             App.handleDynamicChannelName(App.client, VoiceChannel); // Emitted everytime voice state change
         });

        /*
         * Message Event
         */
        App.client.on('message', function (message) {

            App.handleMessage(App.client, message);
        });

    },

    // Handle Dynamic Channel Name
    handleDynamicChannelName: function(client, Channel) {
        // Process all channels in the guild
        App.client.channels.forEach(function(channel) {
            var presenceStats = [];
            presenceStats['.none'] = 0;

            // Voice Channels
            if (channel.type == 'voice') {

                // Match channel against channel prefix (filter)
                if (channel.name.startsWith(App.DynamicChannelName.channelPrefix)) {
                    console.log('========================================================');
                    console.log('[' + channel.id + '] DCN: Processing channel ' + channel.name + '...');

                    // Loop thru all channel participants for this channel
                    var channelParticipants = 0;
                    channel.members.forEach(function(member) {
                        channelParticipants++;

                        // Ugly hack to get presence of the current user, and add stats into an array.
                        member.guild.presences.forEach(function(Presence, userId) {
                            if (member.user.id === userId) {
                                if (isset(Presence.game)) { // We have a game Presence
                                    presenceStats[Presence.game.name] = isset(presenceStats[Presence.game.name]) ? presenceStats[Presence.game.name]+1 : 1;
                                } else {
                                    // Add non presence as stats
                                    presenceStats['.none'] = isset(presenceStats['.none']) ? presenceStats['.none']+1 : 1;
                                }
                            }
                        });
                    });

                    // Get higest presence by procentage
                    var presence,
                        presenceProcentage = 0,
                        presenceStatsHighest,
                        presenceStatsHighestProcentage = 0;
                    for (presence in presenceStats) {
                        presenceProcentage = Math.round((presenceStats[presence] / channelParticipants) * 100, 1);

                        if (presenceProcentage > presenceStatsHighestProcentage) {
                            presenceStatsHighestProcentage = presenceProcentage;
                            presenceStatsHighest = presence;
                        }
                    }
                    presence = presenceStatsHighest;

                    // Construct channel name suggestion
                    var suggestion;
                    suggestion = App.DynamicChannelName.channelPrefix;

                    // 0 channel participants (don't know if this will ever run).
                    if (channelParticipants === 0) {
                        suggestion += App.DynamicChannelName.defaultChannelNameEmpty;
                        suggestion += ' #' + channel.id.substring(channel.id.length-3, channel.id.length);

                    // If presence is meeting target procentage, handle 2 participants.
                    } else if (
                        (presenceProcentage >= App.DynamicChannelName.minPresenceDominanceProcentage)
                        ||
                        (presenceProcentage >= App.DynamicChannelName.minPresenceDominanceProcentage-1 && channelParticipants == 2)
                    ) {
                        // Let's do some presence rewrite, if nessesary
                        if (presence == '.none') presence = App.DynamicChannelName.defaultChannelName;
                        if (presence == 'iexplore') presence = 'Silly Goose!';

                        suggestion += presence;
                        suggestion += ' #' + channel.id.substring(channel.id.length-3, channel.id.length);

                    // Zero presene
                    } else if (presence == '.none') {
                        suggestion += App.DynamicChannelName.defaultChannelName;
                        suggestion += ' #' + channel.id.substring(channel.id.length-3, channel.id.length);

                    // Else
                    } else {
                        // Do nothing
                    }

                    if (App.DynamicChannelName.enabled && channel.name != suggestion) {
                        console.log('[' + channel.id + '] DCN: Changing channel name to \'' + suggestion + '\'');
                        channel.setName(suggestion);
                    } else if (App.DynamicChannelName.enabled && channel.name == suggestion) {
                        console.log('[' + channel.id + '] DCN: Channel name is already per suggestion: ' + suggestion + '\'');
                        //channel.setName(suggestion);
                    } else {
                        console.log('[' + channel.id + '] DCN: Suggesting changing channel name to \'' + suggestion + '\'');
                    }

                }

            }
        });
    },

    // Handle Messages
    handleMessage: function(client, message) {
        console.log('==[ MESSAGE ]=================');
        console.log('<= ' + message.author.username + ': ' + message.content);

        // Ping, Pong!
        if (message.content === 'ping') {
            message.reply('Pong!');

            return;
        }

        // Restart Bot
        if (message.content === 'restart') {
            message.reply('Restarting...');

            // Destory (logout App.client)
            App.client.destroy();

            // Delay reboot
            setTimeout(function() {
                App.run();
            }, 3000);

            return;
        }
    }
};

// Run Application
App.run();
