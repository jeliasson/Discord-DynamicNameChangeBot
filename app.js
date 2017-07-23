const VERSION = '0.2.0';

var Discord = require('discord.js');
var isset = require('isset');
var empty = require('empty');
var md5 = require('md5');
var rs = require('random-string');
var uptimer = require('uptimer');
var checksum = require('checksum');
var path = require('path');

var App = {

    // Discord
    Discord: {
        token: '',
        presence: 'God',
        client: {},
    },

    // Dynamic Channel Name
    DynamicChannelName: {
        enabled: true,                          // Enable keep-alive console log
        channelPrefix: '~ ',                    // Only process channels with this prefix
        defaultChannelName: 'Room',             // Default channel name
        defaultChannelNameEmpty: 'Room',        // Default empty channel name
        minPresenceDominanceProcentage: 50,     // Minimum procentage condition before changing channel name
        minParticipant: 0,                      // Minimum of participant in a channel before changing channel name,
        maxChannelSpawn: 10,                    // @todo
    },

    // Logger
    logger: {
        enabled: true,
        service: {
            discord: {
                enabled: false,                 // Log to Discord
                channel: 'bot-log'              // Log to text channel name
            }
        }
    },

    // Instance
    instance: {
        keepalive: {
            enabled: true,
            interval: 60
        }
    },

    version: VERSION,

    // Run
    run: function(options, callback) {

        // Setup Application
        App.setup();

        // Construct App.Discord.client
        App.Discord.client = new Discord.Client();

        // Login using token
        App.Discord.client.login(App.Discord.token);

        // Client ready
        App.Discord.client.on('ready', function() {
            App.log('** Discord is ready (' + App.Discord.client.user.tag + ')');

            // Set App.Discord.client information
            App.Discord.client.user.setGame(App.Discord.presence);

            // Run callback
            if (typeof callback == "function") {
                callback(options);
            }
        });

        /*
         * Presence Event
         */
        App.Discord.client.on('presenceUpdate', function(statusBefore, statusAfter) {

            App.channelProcessing(App.Discord.client, statusAfter);
        });

        /*
         * Voice Event
         */
         App.Discord.client.on('voiceStateUpdate', function(VoiceChannel, User) {

             App.channelProcessing(App.Discord.client, VoiceChannel); // Emitted everytime voice state change
         });

        /*
         * Message Event
         */
        App.Discord.client.on('message', function (message) {

            App.handleMessage(App.Discord.client, message);
        });

    },

    setup: function() {

        // Only run once
        if (isset(App.Discord.setupCompleted)) return;

        // Application logger
        App.log = function (data = null, options) {
            console.log(data);

            // Discord logging
            if (!isset(App.Discord.channelProcessingisReady) || !App.logger.service.discord.enabled) return;
            App.logger.service.discord.channelObject.sendMessage(data, {

            });
        };

        App.log('** Starting instance');

        // Application file name
        App.instance.file = path.basename(__filename);

        // Application instance id
        App.instance.id = '#' + md5(rs()).substring(0, 5);

        // Application checksum
        App.instance.checksum = checksum.file(path.basename(__filename), function(err, checksum) {
            if (err) App.log(err);
            App.instance.checksum = checksum;

            App.log('** Instance id ' + App.instance.id + ' on checksum ' + App.instance.checksum);
        });

        // Application uptime
        App.instance.uptime = 0;
        setInterval(function() {
            App.instance.uptime = Math.round(uptimer.getAppUptime(), 0) + ' seconds';
        }, 1000);

        // Keep-alive
        App.instance.keepalive.count = 0;
        setInterval(function() {
            if (App.instance.keepalive.enabled) {
                App.instance.keepalive.count++;
                App.log('** Keep-Alive ' + App.instance.keepalive.count + '/' + App.instance.keepalive.interval);
            }
        }, (App.instance.keepalive.interval * 1000));

        App.instance.setupCompleted = true;
    },

    // Handle Dynamic Channel Name
    channelProcessing: function(client, Channel) {
        // Process all channels in the guild
        var presenceTotals = [];
        var channelsTotals = 0;
        App.Discord.client.channels.forEach(function(channel) {
            var presenceStats = [];
            presenceStats['.none'] = 0;

            // Voice Channels
            if (channel.type == 'voice') {

                // Match channel against channel prefix (filter)
                if (channel.name.startsWith(App.DynamicChannelName.channelPrefix)) {

                    channelsTotals++;
                    App.log('\nDCN: Processing channel ' + channel.name + '...');

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

                    // Construct channel name suggestion.channelName
                    var suggestion = {};
                    suggestion.channelPrefix = App.DynamicChannelName.channelPrefix;
                    suggestion.channelName = '';
                    suggestion.channelNumber = '';

                    // 0 channel participants (don't know if this will ever run).
                    if (channelParticipants === 0) {
                        suggestion.channelName = App.DynamicChannelName.defaultChannelNameEmpty;

                    } else if (
                        // If presence is meeting target procentage, handle 2 participants.
                        (presenceProcentage >= App.DynamicChannelName.minPresenceDominanceProcentage)
                        ||
                        (presenceProcentage >= App.DynamicChannelName.minPresenceDominanceProcentage-1 && channelParticipants >= 2)
                    ) {
                        // Let's do some presence rewrite, if nessesary
                        if (presence == '.none') presence = App.DynamicChannelName.defaultChannelName;
                        if (presence == 'iexplore') presence = 'Silly Goose!';

                        suggestion.channelName = presence;

                    } else if (presence == '.none') {
                        // Zero presene
                        suggestion.channelName = App.DynamicChannelName.defaultChannelName;
                    } else {
                        // Do nothing
                        suggestion.channelName = App.DynamicChannelName.defaultChannelName;
                    }

                    nameGenerator = true;
                    nameGeneratorCount = 0;
                    while (nameGenerator) {
                        nameGeneratorCount++;

                        // Channel Number
                        if (nameGeneratorCount > 1) {
                            suggestion.channelNumber = ((nameGeneratorCount < 10) ? ("0" + nameGeneratorCount) : nameGeneratorCount);
                        }

                        // Default channel room
                        suggestion.channelNumber = '(Room ' + channelsTotals + ')';

                        // Override defualt channel rooms
                        if (suggestion.channelName == App.DynamicChannelName.defaultChannelName) {
                            suggestion.channelNumber = channelsTotals;
                        }

                        // Final suggestion to evaluate
                        suggestion.final = suggestion.channelPrefix + ' ' + suggestion.channelName + ' ' + suggestion.channelNumber;

                        if (presenceTotals.indexOf(suggestion.final) <= -1) {
                            presenceTotals.push(suggestion.final);
                            nameGenerator = false;

                            break;
                        }

                        // Break out if we have tried more than max channel spawn count
                        if (nameGeneratorCount > App.DynamicChannelName.maxChannelSpawn) break;
                    }

                    if (App.DynamicChannelName.enabled && channel.name != suggestion.final) {
                        App.log('DCN: Changing channel name to \'' + suggestion.final + '\'');
                        channel.setName(suggestion.final);
                    } else if (App.DynamicChannelName.enabled && channel.name == suggestion.final) {
                        App.log('DCN: Channel name is already per suggestion: ' + suggestion.final + '\'');
                    } else {
                        App.log('DCN: Suggesting changing channel name to \'' + suggestion.final + '\'');
                    }

                }

            }

            // Voice Channels
            if (channel.type == 'text') {

                // Match and save Discord logging channel
                if (channel.name.startsWith(App.logger.service.discord.channel)) {
                    App.logger.service.discord.channelObject = channel;
                }
            }
        });

        App.Discord.channelProcessingisReady = true;
    },

    // Handle Messages
    handleMessage: function(client, message) {

        // Block messages from log channel
        if (message.channel.name == App.logger.service.discord.channel) return;

        // Log inlogging message
        App.log('[MESSAGE] ' + message.author.username + ' in ' + message.channel.name + ': ' + message.content);

        // Ping, Pong!
        if (message.content === 'help') {
            message.reply('[' + App.instance.id + '] Available commands: ping, uptime, restart, debug');

            return;
        }

        // Ping, Pong!
        if (message.content === 'ping') {
            message.reply('[' + App.instance.id + '] Pong!');

            return;
        }

        // Uptime
        if (message.content === 'uptime') {
            message.reply('[' + App.instance.id + '] ' + App.instance.uptime);

            return;
        }

        // Debug
        if (message.content === 'debug') {
            message.reply('[' + App.instance.id + '] ' + ' Debug Information\n========================================\n\n:: App\nVersion: ' + App.version + '\n\n:: Instance\nId: ' + App.instance.id + '\nFile: ' + App.instance.file + '\nChecksum: ' + App.instance.checksum + '\nUptime = ' + App.instance.uptime + '\nKeep-Alive Count: ' + App.instance.keepalive.count + '\nKeep-Alive Interval: ' + App.instance.keepalive.interval + '\n\n:: Environment\nComputer Name: ' + process.env.COMPUTERNAME + '\n\n========================================');

            return;
        }

        // Restart Bot
        if (message.content === 'restart') {
            message.reply('[' + App.instance.id + '] ' + ' Restarting...\n===============================\nYou may want to repool by requesting http://jeliasson-discord-bot.azurewebsites.net/');

            // Destory (logout App.Discord.client)
            App.Discord.client.destroy();

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
