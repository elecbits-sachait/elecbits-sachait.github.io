(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

var awsConfiguration = {
   poolId: 'ap-south-1:779f5343-aa0d-4230-bca4-00a2e9df4fc5', // 'YourCognitoIdentityPoolId'
   host: 'a1lgz1948lk3nw-ats.iot.ap-south-1.amazonaws.com', // 'YourAwsIoTEndpoint', e.g. 'prefix.iot.us-east-1.amazonaws.com'
   region: 'ap-south-1' // 'YourAwsRegion', e.g. 'us-east-1'
};
module.exports = awsConfiguration;


},{}],2:[function(require,module,exports){



  var app = angular.module("myApp", []);
  app.controller("myCtrl", function($scope, $http, $sce) {

      $scope.sirenStatus = 'OFF';

      var notificationAudio = new Audio('notification.mp3');
      var sirenAudio = new Audio('siren.mp3');

      $http.get("https://sgddji95n8.execute-api.ap-south-1.amazonaws.com/prod/policenotification?actionStatus=noActionTaken&count=10")
          .then(function(response) {
              $scope.notifications = response.data;
          });

      $http.get("https://sgddji95n8.execute-api.ap-south-1.amazonaws.com/prod/policenotification/stats")
          .then(function(response) {
              $scope.stats = response.data;
              $scope.devicePercent = (($scope.stats.deviceCount / $scope.stats.totalNotificationCount) * 100).toFixed(1);
              $scope.appPercent = (($scope.stats.applicationCount / $scope.stats.totalNotificationCount) * 100).toFixed(1);
          });

      window.setInterval(function() {
          $http.get("https://sgddji95n8.execute-api.ap-south-1.amazonaws.com/prod/policenotification?actionStatus=noActionTaken&count=10")
              .then(function(response) {
                  $scope.notifications = response.data;
                  console.log(response.data);
              });

          $http.get("https://sgddji95n8.execute-api.ap-south-1.amazonaws.com/prod/policenotification/stats")
              .then(function(response) {
                  $scope.stats = response.data;
              });
          $scope.actionTakenPercent = (($scope.stats.actionTaken / $scope.stats.totalNotificationCount) * 100).toFixed(1);
          $scope.noActionTakenPercent = (($scope.stats.noActionTaken / $scope.stats.totalNotificationCount) * 100).toFixed(1);
      }, 5000);

      $scope.openLocationModal = function(notif) {
          $scope.locationData = notif.victimCompleteLocation;
          $scope.imagesData = notif.victimNearbyImages;
          $scope.locationUrl = $sce.trustAsResourceUrl('https://maps.google.com/maps?q=' + notif.victimLocation[0] + ',' + notif.victimLocation[1] + '&t=&z=13&ie=UTF8&iwloc=&output=embed');
          $('#locationModal').modal('show');
      }

      $scope.openLiveFeedModal = function(notif) {
          $scope.notificationData = notif;
          $('#liveFeedModal').modal('show');
          $scope.liveFeedUrl = $sce.trustAsResourceUrl(notif.victimCamFeed);
      }

      $scope.takeAction = function(notificationId, escalationTimestamp) {
        $http({
            method: "PUT",
            url: 'https://sgddji95n8.execute-api.ap-south-1.amazonaws.com/prod/take-action',
            data: JSON.stringify({"notificationId": notificationId, "escalationTimestamp": escalationTimestamp, "actionStatus": "actionTaken"}),
            contentType: 'application/json'
        }).then(function mySuccess(response) {
            if(response.status == 204) {
              alert('Action Taken against the Notification!');
            }
        }, function myError(response) {
            alert('Error in taking action: ', response);
        });          
      }

      $scope.requestHelp = function(notificationId) {
        $http({
            method: "POST",
            url: 'https://sgddji95n8.execute-api.ap-south-1.amazonaws.com/prod/request-help',
            data: JSON.stringify({"notificationId": notificationId}),
            contentType: 'application/json'
        }).then(function mySuccess(response) {
            if(response.status == 201) {
              alert('SMS triggered to first responders');
            }
        }, function myError(response) {
            alert('Error in taking action: ', response);
        });          
      }

      $scope.timestampToDate = function(UNIX_timestamp) {
          var a = new Date(UNIX_timestamp * 1000);
          var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          var year = a.getFullYear();
          var month = months[a.getMonth()];
          var date = a.getDate();
          var hour = a.getHours();
          var min = a.getMinutes();
          var sec = a.getSeconds();
          var time = hour + ':' + min + ':' + sec + ' ' + date + '/' + month + '/' + year;
          return time;
      }

      $scope.playSirenFunction = function(sirenId, mode) {

         $scope.payload = {
             "state" : {
               "desired": {
                 "mode" : [mode]
               }
             }
          }

          var topic = '$aws/things/' + sirenId + '/shadow/update';

         console.log('topic: ', topic, ' payload: ', JSON.stringify($scope.payload));

         if(mode == 'ON') {
           sirenAudio.play();
           //$scope.sirenStatus = 'on'
         } else {
           sirenAudio.pause();
           sirenAudio.currentTime = 0;
           //$scope.sirenStatus = 'off';
         }

         $scope.sirenStatus = mode;

         mqttClient.publish(topic,
                             JSON.stringify($scope.payload));
      }

      var AWS = require('aws-sdk');
      var AWSIoTData = require('aws-iot-device-sdk');
      var AWSConfiguration = require('./aws-configuration.js');
      var currentlySubscribedTopic = '$aws/things/gps_002/shadow/update';
      var messageHistory = '';
      var clientId = 'mqtt-explorer-' + (Math.floor((Math.random() * 100000) + 1));
      AWS.config.region = AWSConfiguration.region;

      AWS.config.credentials = new AWS.CognitoIdentityCredentials({
          IdentityPoolId: AWSConfiguration.poolId
      });
      const mqttClient = AWSIoTData.device({

          region: AWS.config.region,
          //
          ////Set the AWS IoT Host Endpoint
          host: AWSConfiguration.host,
          //
          // Use the clientId created earlier.
          //
          clientId: clientId,
          //
          // Connect via secure WebSocket
          //
          protocol: 'wss',
          //
          // Set the maximum reconnect time to 8 seconds; this is a browser application
          // so we don't want to leave the user waiting too long for reconnection after
          // re-connecting to the network/re-opening their laptop/etc...
          //
          maximumReconnectTimeMs: 8000,
          //
          // Enable console debugging information (optional)
          //
          debug: true,
          //
          // IMPORTANT: the AWS access key ID, secret key, and sesion token must be 
          // initialized with empty strings.
          //
          accessKeyId: '',
          secretKey: '',
          sessionToken: ''
      });

      var cognitoIdentity = new AWS.CognitoIdentity();
      AWS.config.credentials.get(function(err, data) {
          if (!err) {
              console.log(AWS.config.credentials);
              var params = {
                  IdentityId: AWS.config.credentials.identityId
              };
              cognitoIdentity.getCredentialsForIdentity(params, function(err, data) {
                  if (!err) {
                      mqttClient.updateWebSocketCredentials(data.Credentials.AccessKeyId,
                          data.Credentials.SecretKey,
                          data.Credentials.SessionToken);
                  } else {
                      console.log('error retrieving credentials: ' + err);
                      alert('error retrieving credentials: ' + err);
                  }
              });
          } else {
              console.log('error retrieving identity:' + err);
              alert('error retrieving identity: ' + err);
          }
      });


      window.mqttClientConnectHandler = function() {
          console.log('connect');
          mqttClient.subscribe(currentlySubscribedTopic);
      };


      window.mqttClientReconnectHandler = function() {
          console.log('reconnect');
      };


      window.isUndefined = function(value) {
          return typeof value === 'undefined' || typeof value === null;
      };


      window.mqttClientMessageHandler = function(topic, payload) {
          console.log('topic: ' + topic + '  message: ' + payload.toString());
      };

      mqttClient.on('connect', window.mqttClientConnectHandler);
      mqttClient.on('reconnect', window.mqttClientReconnectHandler);
      mqttClient.on('message', window.mqttClientMessageHandler);


  });

},{"./aws-configuration.js":1,"aws-iot-device-sdk":"aws-iot-device-sdk","aws-sdk":"aws-sdk"}]},{},[2]);
