# Discord Bot
## Dynamic Name Change

This is a [Discord Bot](https://discordapp.com/developers/docs/topics/oauth2) using [Discord.js](https://github.com/hydrabolt/discord.js/). It will, as the name suggest, dynamically change Voice Channel's name based on the [presence](http://discordjs.readthedocs.io/en/latest/docs_client.html), e.g. what the participants is playing. It can be targeted to channels with prefix. It will run anywhere you can run Node.js, more or less.

### Requirement
* Server running [node.js](https://nodejs.org/en/).
* A [Discord bot](https://discordapp.com/developers/applications/me) registered.
* Discord Server/Guild permission `Manage Channels`.

### Installation
1. Have the Discord bot [join your server](https://www.reddit.com/r/discordapp/comments/4sljmt/how_the_fuck_do_i_make_a_bot_join_a_server/).

2. Fork and clone this repository, or unpack the source in a ZIP archive.

3. Set Discord Bot token, ```DISCORD_TOKEN``` in file ```.env```.

4. Define settings in ```app.js```, section ```DynamicChannelName```.

5. Install dependencies.
```bash
npm install
```

6. Start bot.
```bash
node start
```

## Demo
Join the [Demo Discord Guild](https://discord.gg/23qkAvh).

## Contribute
Feel free to contribute by forking and send your Pull Request!
