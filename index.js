'use strict';
const Alexa = require('ask-sdk-core');
const request = require('request-promise-native');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        console.log(handlerInput.requestEnvelope.request);
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speechText = 'Welcome to Word Association! Start by saying any word and I\'ll respond with the first thing that comes to mind and then we\'ll go back and forth from there! What word should we start with?';
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            //TODO .withSimpleCard('Hello World', speechText)
            .getResponse();
    }
};

const WordAssociationIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'WordAssociationIntent'
            && handlerInput.requestEnvelope.request.dialogState !== 'COMPLETED';;
    },
    async handle(handlerInput) {
        const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
        console.log(requestEnvelope.request);
        const { intent } = requestEnvelope.request;
        console.log("hi");

        const errorResponses = [
            "Hmm. I'm having a hard time thinking of something for that one. Can you give me another word?",
            "Sorry, I got nothing... can we try a different word?",
            "Uh oh. I swear this never happens. Please repeat that for me?"
        ];
        const prefixes = [
            { text: "", weight: 7 },
            { text: "That reminds me of... ", weight: 1 },
            { text: "How about... ", weight: 1 },
            { text: "Oooh, good one! Let's go with... ", weight: 1 }
        ];
        const threshhold = 75;
        const pos = "noun,adjective,verb,adverb";



        let weightTotal = 0;
        let randomPrefixes = [];
        for (var i = 0; i < prefixes.length; i++)
        {
            for (var j = 0; j < prefixes[i].weight; j++)
            {
                randomPrefixes.push(prefixes[i].text);
                weightTotal += 1;
            }
        }

        const errorResponse = errorResponses[Math.round(Math.random() * (errorResponses.length-1))];
        const randomPrefix = randomPrefixes[Math.round(Math.random() * (weightTotal-1))];


        let wordResponse = null;
        let isError = false;
        const word = intent.slots.word.value;
        console.log(word);
        var wordAssociationApiParams = {
            resolveWithFullResponse: true,
            url: "https://api.wordassociations.net/associations/v1.0/json/search?apikey=&text=" + encodeURIComponent(word) + "&lang=en&type=response&indent=no&pos=" + pos,
            json: true
          };
          await request(wordAssociationApiParams)
            .then(function(response) {
              if (response.statusCode == 200
                && response
                && response.body
                && response.body.response
                && response.body.response[0]
                && response.body.response[0].items)
                {
                    let items = response.body.response[0].items;
                    
                    let threshholdItems = [];
                    for (var i = 0; i < items.length; i++)
                    {
                        if (items[i].weight >= threshhold)
                        {
                            threshholdItems.push(items[i]);
                        }
                    }

                    // get items length and randomly pick one
                    var random = Math.round(Math.random() * (threshholdItems.length-1));
                    
                    if (threshholdItems
                        && threshholdItems[0]
                        && threshholdItems[random]
                        && threshholdItems[random].item)
                        wordResponse = threshholdItems[random].item;
                }

              else {
                console.log('response: ', response.statusCode, response.body);
                wordResponse = errorResponse;
                isError = true;
              }
            })
            .catch(function(err) {
                console.log('response: ', err);
                wordResponse = errorResponse;
                isError = true;
            });

            return responseBuilder
                .speak((isError ? "" : randomPrefix) + wordResponse)
                .withSimpleCard('Word Association', wordResponse)
                .addElicitSlotDirective("word")
                .getResponse();
        
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechText = 'You can say hello to me!';
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withSimpleCard('Hello World', speechText)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speechText = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speechText)
            .withSimpleCard('Hello World', speechText)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        //any cleanup logic goes here
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
      return true;
    },
    handle(handlerInput, error) {
      console.log(`Error handled: ${error.message}`);
    return handlerInput.responseBuilder
        .speak('Sorry, I can\'t understand the command. Please say again.')
        .reprompt('Sorry, I can\'t understand the command. Please say again.')
        .getResponse();
    },
};


exports.handler = Alexa.SkillBuilders.custom()
     .addRequestHandlers(LaunchRequestHandler,
                         WordAssociationIntentHandler,
                         HelpIntentHandler,
                         CancelAndStopIntentHandler,
                         SessionEndedRequestHandler)
     .lambda();