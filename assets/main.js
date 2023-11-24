(function () {
    var client = ZAFClient.init();
    client.invoke('resize', { width: '100%', height: '200px' });
    client.on('app.registered', function(appData) {
      var currentLocation = appData.context.location;
      client.metadata().then(function(metadata) {
        if (currentLocation === 'user_sidebar') {
          client.get('user').then(
            function(data) {
              requestEmailServer(client, data.user.email, metadata.settings);
            },
            function(response) {
              showError(response);
            }
          );
        } else if (currentLocation === 'ticket_sidebar') {
          client.get('ticket.requester.id').then(
            function(data) {
                var user_id = data['ticket.requester.id'];
                requestUserInfo(client, user_id, metadata.settings);
            }
          );
        }
      });
      
    });
    
})();

function showInfo(data) {
  var requester_data = {
      'isMigrated': data.isMigrated,
      'migrateStatus': data.migrateStatus,
      'username': data.username,
      'userStatus': data.userStatus,
      'forward': data.forward,
      'quota': data.quota,
      'usedQuota': data.UsedQuota,
      'totpStatus': data.totpStatus
  };

  var source = document.getElementById("requester-template").innerHTML;
  var template = Handlebars.compile(source);
  var html = template(requester_data);
  document.getElementById("content").innerHTML = html;
}

function showError(response) {
    var error_data = {
        'status': response.status,
        'statusText': response.statusText
    };
  
    var source = document.getElementById("error-template").innerHTML;
    var template = Handlebars.compile(source);
    var html = template(error_data);
    document.getElementById("content").innerHTML = html;
}

function requestUserInfo(client, id, metadata) {
  var settings = {
      url: '/api/v2/users/' + id + '.json',
      type:'GET',
      dataType: 'json',
    };
  
    client.request(settings).then(
      function(data) {
        requestEmailServer(client, data.user.email, metadata);
      },
      function(response) {
        showError(response);
      }
    );
}

function formatDate(date) {
    var cdate = new Date(date);
    var options = {
      year: "numeric",
      month: "short",
      day: "numeric"
    };
    date = cdate.toLocaleDateString("en-us", options);
    return date;
}


function requestEmailServer(client, email, metadata) {
  var settings = {
      url: metadata.mailServerUrl,
      type: 'POST',
      headers: {
          'Authorization': 'Basic ' + btoa(`${metadata.username}:${metadata.password}`),
          'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: `username=${email}`,
      dataType: 'xml',
  };

  function parseXmlData(xmlString) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(xmlString, "text/xml");

    var keys = [
        'accountId', 'createdByUserId', 'username', 'domainId', 'dateModified', 'dateCreate',
        'userStatus', 'migrateStatus', 'forward', 'quota', 'masterQuota', 'lastLogin',
        'groupId', 'firstName', 'lastName', 'mboxServer', 'mboxType', 'billingCode',
        'UsedQuota', 'TotalMessages', 'totalQuotaBytes', 'mailUsedBytes', 'fileUsedBytes',
        'totalFiles', 'quotaStatus', 'totpStatus'
    ];

    var pasreData = {};
    keys.forEach(function (key) {
        pasreData[key] = xmlDoc.querySelector(key).textContent;
    });

    pasreData['isMigrated'] = pasreData['migrateStatus'] === 'Migrated' ? true : false;

    return pasreData;
  }

  function convertBytesToSize(valueInMB) {
    const valueInGB = valueInMB / 1024;
    if (valueInGB >= 1) {
      const valueInTB = valueInGB / 1024;
      if (valueInTB >= 1) {
        return `${valueInTB} TB`;
      } else {
        return `${valueInGB} GB`;
      }
    } else {
      return `${valueInMB} MB`;
    }
  }

  function convertQuota(quota, usedQuota) {
    convertedQuota = convertBytesToSize(quota);
    convertedUsedQuota = convertBytesToSize(usedQuota);
    return {
      convertedQuota: convertedQuota,
      convertedUsedQuota: `${convertedUsedQuota} (${(usedQuota / quota) * 100}%)`
    };
  }

  client.request(settings).then(
    function(data) {
      var pasreData = parseXmlData(data);
      const result = convertQuota(pasreData["quota"], pasreData["UsedQuota"]);
      pasreData["quota"] = result.convertedQuota;
      pasreData["UsedQuota"] = result.convertedUsedQuota;
      showInfo(pasreData);
    },
      function(response) {
          showError(response);
      }
  );
}