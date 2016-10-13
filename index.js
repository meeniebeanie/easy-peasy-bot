/**
 * A Bot for Slack!
 */

var Botkit = require('botkit');


/**
 * Define a function for initiating a conversation on installation
 * With custom integrations, we don't have a way to find out who installed us, so we can't message them :(
 */

function onInstallation(bot, installer) {
    if (installer) {
        bot.startPrivateConversation({user: installer}, function (err, convo) {
            if (err) {
                console.log(err);
            } else {
                convo.say('I am a bot that has just joined your team');
                convo.say('You must now /invite me to a channel so that I can be of use!');
            }
        });
    }
}


/**
 * Configure the persistence options
 */

var config = {};
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
    };
} else {
    config = {
        json_file_store: ((process.env.TOKEN)?'./db_slack_bot_ci/':'./db_slack_bot_a/'), //use a different name if an app or CI
    };
}

/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */

if (process.env.TOKEN || process.env.SLACK_TOKEN) {
    //Treat this as a custom integration
    var customIntegration = require('./lib/custom_integrations');
    var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
    var controller = customIntegration.configure(token, config, onInstallation);
} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
    //Treat this as an app
    var app = require('./lib/apps');
    var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
    console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENTID, CLIENTSECRET, and PORT in the environment');
    process.exit(1);
}


/**
 * A demonstration for how to handle websocket events. In this case, just log when we have and have not
 * been disconnected from the websocket. In the future, it would be super awesome to be able to specify
 * a reconnect policy, and do reconnections automatically. In the meantime, we aren't going to attempt reconnects,
 * WHICH IS A B0RKED WAY TO HANDLE BEING DISCONNECTED. So we need to fix this.
 *
 * TODO: fixed b0rked reconnect behavior
 */
// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});


/**
 * Core bot logic goes here!
 */
// BEGIN EDITING HERE!

//

controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "I'm here! ✨✨✨")
});

controller.hears(['hello', 'hey'], 'direct_message', function (bot, message) {
    console.log('ayee');
    bot.reply(message, 'What\'s up!✨');
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears('what is my name?', 'direct_message', function (bot, message) {
    controller.storage.users.get(message.user, function(err,user) {
      if (user && user.name) {
        bot.reply(message, 'Your name is ' + user.name);
      } else {
        bot.startConversation(message,function(err, convo) {
          if (!err) {
            convo.say('You haven\'t told me your name!');
            convo.ask('What is your name?',
            function(response, convo) {
              convo.ask('You want me to call you `' + response.text + '`?', [
                {
                  pattern: 'yes',
                  callback: function(response, convo) {
                    convo.next();
                  }
                },
                {
                  pattern: 'no',
                  callback: function(response, convo) {
                    convo.stop();
                  }
                },
                {
                  default: true,
                  callback: function(response, convo) {
                    convo.repeat();
                    convo.next();
                  }
                }
              ]);
              convo.next();
            }, {'key': 'nickname'});

            convo.on('end', function(convo) {
              if (convo.status == 'completed') {
                bot.reply(message, 'Alright! I\'m updating my dossier...');
                controller.storage.users.get(message.user, function(err, user){
                  if (!user) {
                    user = {
                      id: message.user,
                    };
                  }
                  user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                })
              }
            })
          }
          else {
          bot.reply(message, 'OK, nevermind!');
          }
        });
      }
    });
});

controller.hears(['shit','knnbccb','bullshit','damn','fuck'], 'direct_message', function (bot, message) {
  var swearjar = {};

    controller.storage.users.get(swearjar.user, function(err, swearjar) {
      if (!swearjar) {
        swearjar = {
          counter: 0,
        };
      } else {
        swearjar.counter++;
      }

      controller.storage.users.save(swearjar, function(err, counter){
        bot.reply(message, '+1 to the swear jarrr. Current swearjar count is ' + swearjar.counter );
      });
    });
});

// KOPI ORDERING!

// controller.hears(['order drinks','kopi time'],['ambient'],function(bot,message) {
//   bot.startConversation(message, askDrink);
// });
//
// askDrink = function(response, convo) {
//   convo.ask("What drink do you want?", function(response, convo) {
//     convo.say("Okay! So you want (.*)")
//   })
// }

controller.hears('kopi time','direct_message,direct_mention',function(bot,message) {
  var reply_with_attachments = {
    "text": "What drink would you like?",
    "attachments": [
        {
            "text": "What do you wanna drink?",
            "fallback": "You are unable to order",
            "callback_id": "order_drink",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "Kopi",
                    "text": "Kopi",
                    "type": "button",
                    "value": "kopi"
                },
                {
                    "name": "Teh",
                    "text": "Teh",
                    "type": "button",
                    "value": "teh"
                },
                {
                    "name": "Milo",
                    "text": "Milo",
                    "type": "button",
                    "value": "milo",
                }
            ]
        }
    ]
}

  bot.reply(message, reply_with_attachments);
});

controller.hears('open the (.*) doors','direct_message,direct_mention,mention',function(bot,message) {
  var doorType = message.match[1]; //match[1] is the (.*) group. match[0] is the entire group (open the (.*) doors).
  if (doorType === 'pod bay') {
    return bot.reply(message, 'I\'m sorry, Dave. I\'m afraid I can\'t do that.');
  }
  return bot.reply(message, 'Okay');
});




/**
 * AN example of what could be:
 * Any un-handled direct mention gets a reaction and a pat response!
 */
//controller.on('direct_message,mention,direct_mention', function (bot, message) {
//    bot.api.reactions.add({
//        timestamp: message.ts,
//        channel: message.channel,
//        name: 'robot_face',
//    }, function (err) {
//        if (err) {
//            console.log(err)
//        }
//        bot.reply(message, 'I heard you loud and clear boss.');
//    });
//});
