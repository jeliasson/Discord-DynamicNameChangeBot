const VERSION = '0.4.7';

var Discord = require('discord.js');
var env = require('node-env-file');
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
        presence: 'Hotel',                        // Presence to display on the bot
        client: {},
    },

    // Dynamic Channel Name
    DynamicChannelName: {
        enabled: true,                         // Enable Dynamic Channel Name (dry-run or not)
        channelPrefix: '~ ',                    // Only process channels with this prefix
        defaultChannelName: 'Room',             // Default channel name
        defaultChannelNameEmpty: 'Room',        // Default empty channel name
        minPresenceDominanceProcentage: 50,     // Minimum procentage condition before changing channel name
        minParticipant: 0,                      // Minimum of participant in a channel before changing channel name
        maxChannelSpawn: 10,                    // @todo
        maxChannelNameLength: 14,               // Maximum generated channel name length (excluding prefix and room number)
    },

    // Logger
    logger: {
        enabled: true,
        service: {
            discord: {
                enabled: true,                  // Log to Discord
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

        // Construct Discord.client()
        App.Discord.client = new Discord.Client();

        // Discord token
        App.Discord.token = (process.env.DISCORD_TOKEN) ? process.env.DISCORD_TOKEN : false;

        if (!App.Discord.token) {
            App.log('!! Discord token is not defined (DISCORD_TOKEN).');

            process.exit();
        }

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

            App.DynamicChannelName.process(App.Discord.client, statusAfter);
        });

        /*
         * Voice Event
         */
         App.Discord.client.on('voiceStateUpdate', function(VoiceChannel, User) {

             App.DynamicChannelName.process(App.Discord.client, VoiceChannel);
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

        // Process environment variables
        env(__dirname + '/.env');

        // Application logger
        App.log = function (data = null, options = null) {
            options = Object.assign({}, {
                discord : false
            }, options);

            // Log
            console.log(data);

            // Discord logging
            if (isset(App.channelProcessingisReady) && App.logger.service.discord.enabled && options.discord)
                App.logger.service.discord.channelObject.sendMessage(data, { });
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

            App.log('** Instance id ' + App.instance.id + ' (Checksum: ' + App.instance.checksum + ')');
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
                App.log('** Keep-Alive ' + App.instance.keepalive.count + ' count/' + App.instance.keepalive.interval + ' sec.');
            }
        }, (App.instance.keepalive.interval * 1000));

        App.instance.setupCompleted = true;
    },

    // Handle Messages
    handleMessage: function(client, message) {

        // Block messages from log channel
        if (message.channel.name == App.logger.service.discord.channel) return;

        // Log inlogging message
        App.log('[MESSAGE] ' + message.author.username + ' in ' + message.channel.name + ': ' + message.content);

        // Help
        if (message.content === 'help') {
            message.reply('[' + App.instance.id + '] Available commands: ping, uptime, restart, debug');

            return;
        }

        // Ping
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

        // Restart
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

/*
 * Process Dynamic Channel Name with presence
 */
App.DynamicChannelName.process = function(client, Channel) {

    var presence = {};
    presence.totals = [];
    presence.totalChannels = 0;

    // Process all channels in the guild
    App.Discord.client.channels.forEach(function(channel) {

        // Voice Channels
        if (channel.type == 'voice') {

            // Match channel against channel prefix (filter)
            if (channel.name.startsWith(App.DynamicChannelName.channelPrefix)) {
                presence.stats = [];
                presence.totalChannels++;
                App.log('\nDCN: Processing channel ' + channel.name + '...');

                // Get channel presences
                var channelParticipants = 0;
                channel.members.forEach(function(member) {
                    channelParticipants++;

                    // Ugly hack to get presence of the current user, and add stats into an array.
                    member.guild.presences.forEach(function(Presence, userId) {
                        if (member.user.id === userId) {
                            if (isset(Presence.game)) {
                                presence.stats[Presence.game.name] = isset(presence.stats[Presence.game.name]) ? presence.stats[Presence.game.name]+1 : 1;
                            } else {
                                presence.stats['.none'] = isset(presence.stats['.none']) ? presence.stats['.none']+1 : 1;
                            }
                        }
                    });
                });

                // Get top presence
                presence.currentName = '';
                presence.currentProcentage = 0;
                presence.highestName = '';
                presence.highestProcentage = 0;
                for (presence.currentName in presence.stats) {
                    presence.currentProcentage = Math.round((presence.stats[presence.currentName] / channelParticipants) * 100, 1);
                    if (presence.currentProcentage > presence.highestProcentage && presence.currentName != '.none') {
                        presence.highestProcentage = presence.currentProcentage;
                        presence.highestName = presence.currentName;
                    }
                }
                presence.currentName = presence.highestName;

                // Channel name suggestion
                var suggestion = {};
                suggestion.channelPrefix = App.DynamicChannelName.channelPrefix;
                suggestion.channelName = '';
                suggestion.channelNumber = '';

                // 0 channel participants (don't know if this will ever run).
                if (channelParticipants === 0) {
                    suggestion.channelName = App.DynamicChannelName.defaultChannelNameEmpty;
                } else if (
                    // If presence is meeting target procentage, handle 2 participants.
                    (presence.highestProcentage >= App.DynamicChannelName.minPresenceDominanceProcentage)
                    ||
                    (presence.highestProcentage >= App.DynamicChannelName.minPresenceDominanceProcentage-1 && channelParticipants >= 2)
                ) {
                    // Let's do some presence rewrite, if nessesary
                    if (presence.currentName == 'iexplore') presence.currentName = 'Silly Goose!';
                    if (presence.currentName == 'Project Argo (Prototype)') presence.currentName = 'Argo';
                    if (presence.currentName == 'Unity') presence.currentName = 'Programming';
                    
                    // Default to none
                    if (presence.currentName == 'wallpaper_engine') presence.currentName = '.none';
                    if (presence.currentName == 'Spotify') presence.currentName = '.none';
                    
                    // If we have none, let's grab the default channel name
                    if (presence.currentName == '.none') presence.currentName = App.DynamicChannelName.defaultChannelName;

                    suggestion.channelName = presence.currentName;

                } else if (presence.currentName == '.none') {
                    // Zero presene
                    suggestion.channelName = App.DynamicChannelName.defaultChannelName;
                } else {
                    // Do nothing
                    suggestion.channelName = App.DynamicChannelName.defaultChannelName;
                }

                // Make channel name shorter if nessesary
                suggestion.channelName = (suggestion.channelName.length > App.DynamicChannelName.maxChannelNameLength) ? suggestion.channelName.substring(0, App.DynamicChannelName.maxChannelNameLength) + '...' : suggestion.channelName;

                // Final name generator
                var nameGenerator = {};
                nameGenerator.run = true;
                nameGenerator.count = 0;
                while (nameGenerator.run) {
                    nameGenerator.count++;

                    // Channel Number
                    if (nameGenerator.count > 1) {
                        suggestion.channelNumber = ((nameGenerator.count < 10) ? ("0" + nameGenerator.count) : nameGenerator.count);
                    }

                    // Default channel room
                    suggestion.channelNumber = '(' + App.DynamicChannelName.defaultChannelName + ' ' + presence.totalChannels + ')';

                    // Override defualt channel rooms
                    if (suggestion.channelName == App.DynamicChannelName.defaultChannelName) {
                        suggestion.channelNumber = presence.totalChannels;
                    }

                    // Final suggestion to evaluate
                    suggestion.final = suggestion.channelPrefix + ' ' + suggestion.channelName + ' ' + suggestion.channelNumber;
                    if (presence.totals.indexOf(suggestion.final) <= -1) {
                        presence.totals.push(suggestion.final);
                        nameGenerator.run = false;

                        break;
                    }

                    // Break out if we have tried more than max channel spawn count
                    if (nameGenerator.count > App.DynamicChannelName.maxChannelSpawn) break;
                }

                //console.log(suggestion, presence);

                if (App.DynamicChannelName.enabled && channel.name != suggestion.final) {
                    App.log('DCN: Changing channel name to \'' + suggestion.final + '\'');
                    App.log('DCN: Changing channel name from \'' + channel.name + '\' to \'' + suggestion.final + '\'.\n', {
                        discord: false
                    });

                    // Change the channel name
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
};

// Run Application
App.run();
