require(["jquery", "foundation", "peaks"], function($,foundation,Peaks) {

  /* ======= Octopus ======= */

  var octopus = {
    init: function() {
      // timehistoryView.init();
      noisefreeView.init();
      waveformView.init();
      sliderView.init();
    },

    getTimeHistory: function() {
      return model.timeHistory;
    },

    getThreshold: function() {
      return model.threshold;
    },

    setThreshold: function(thresh) {
      model.threshold = thresh;
    },

    getFileLength: function() {
      return model.timeHistory[model.timeHistory.length - 1]["Te"]
    },

    generateNoiseFreeRegions: function() {
      // Set up storage for our passing rows
      var passing_rows = [];
      var last_passing_row = false;

      // Need to clone using this slightly clunky method or it messes up our original data
      var all_rows = JSON.parse(JSON.stringify(this.getTimeHistory()));

      for (i = 0; i < all_rows.length; i++) {
        row = all_rows[i];
        // Check if it passes
        if(row["QDeg"] <= this.getThreshold()) {
          // Check if Te of the previous row = Ts of this row
          if(last_passing_row["Te"] == row["Ts"]) {
            // If it is, then set the end time of the previous row to this end time
            passing_rows[passing_rows.length - 1]["Te"] = row["Te"];
            last_passing_row = passing_rows[passing_rows.length - 1];
          } else {
            // If not, push to the array and set our last passing row counter
            passing_rows.push(row);
            last_passing_row = row;            
          };
        }
        // And dump this in our model
        model.passingRegions = passing_rows;
      }
    },

    getNoiseFreeRegions: function() {
      return model.passingRegions;
    }
  };


  /* ======= Views ======= */

  var timehistoryView = {
    init: function() {
      this.tableElem = document.getElementById('time-history-table').getElementsByTagName('tbody')[0];
      this.render();
    },

    render: function() {
      // We could consider refactoring to add an update function but this seems fast enough
      this.tableElem.innerHTML = '';
      // For each time history, make a tr
      octopus.getTimeHistory().forEach(function(row) {
        // Our row
        var newRow = timehistoryView.tableElem.insertRow();

        // For each, make the cells
        for (var c in row) {
          var cell = newRow.insertCell();
          cell.textContent = row[c];
        };

        // If the row is below the threshold, colour it yellow
        if(row["QDeg"] <= octopus.getThreshold()) {
          newRow.className = "pass";
        };

      })
    }
  }

  var sliderView = {
    init: function() {
      this.sliderElem = $('#threshold-slider');
      this.render();
    },

    render: function() {
      $(document).foundation({
        slider: {
          on_change: function(){
            // Set the threshold
            thresh = sliderView.sliderElem.attr('data-slider');
            // A little throttling
            setTimeout(function() {
              octopus.setThreshold(thresh);
              // Update the noise free regions
              octopus.generateNoiseFreeRegions();
              // Render time history
              // timehistoryView.render();
              // Render noise free regions
              noisefreeView.render();
              // Wait a second before drawing waveform, very resource intensive
              setTimeout(function() {
                waveformView.update();
              }, 1000);
            }, 100);
          }
        }
      });
    }
  }

  var waveformView = {
    init: function() {
      // Set up the peaks element
      url = model.url // Should go through octupus rlly

      this.peaksElem = Peaks.init({
        container: document.querySelector('#peaks-container'),
        mediaElement: document.querySelector('audio'),
        segmentColor: "#25E063",
        playheadColor: "#0abaee",
        overviewWaveformColor: "#5B5B5B",
        zoomWaveformColor: "#5B5B5B",
        randomizeSegmentColor: false,
        dataUri: { arraybuffer: '/' + url + '/waves.dat' }
      });

      this.render();
    },

    render: function() {
      this.peaksElem.on('segments.ready', function() {
        waveformView.update();
      });
    },

    update: function() {
      // Clear
      this.peaksElem.segments.removeAll();
      regions = octopus.getNoiseFreeRegions();
      rstring = [];

      for(i = 0; i < regions.length; i++) {
        rstring[i] =  {
          startTime: regions[i]["Ts"],
          endTime: regions[i]["Te"],
          labelText: "Noise-free region"
        };
      }
      
      // Add
      this.peaksElem.segments.add(rstring);
    }
  }


  var noisefreeView = {
    init: function() {
      this.tableElem = document.getElementById('wind-free-regions').getElementsByTagName('tbody')[0];
      if(model.is_not_example) {
        // This controls if the download button is disabled or not
        this.downloadBtn = document.getElementById("downloadbtn");
        // For telling the user why their download is disabled
        this.downloadError = document.getElementById("downloaderror");
      }
      this.render();
    },

    render: function() {
      // Maximum regions to render
      var MAX_REGIONS = 5
      var regions = octopus.getNoiseFreeRegions();
      this.tableElem.innerHTML = '';
      // If there's more than X results, hide the list for brevity.
      if (regions.length > MAX_REGIONS && !model.showAllRegionsToggle) {
        var newRow = noisefreeView.tableElem.insertRow();
        var toolong = newRow.insertCell()
        toolong.colSpan = 2;
        toolong.className = "regions-expand";
        toolong.textContent = "More than 5 results. Click here to show all regions.";
        toolong.addEventListener('click', function() {
          model.showAllRegionsToggle = true;
          noisefreeView.render();
        })
      } 
      else {
        // Show all the items
        for(i = 0; i < regions.length; i++) {
          region = regions[i];
          // Doing this manually as its just as quick as getting rid of 2 cols we don't need
          var newRow = noisefreeView.tableElem.insertRow();
          var ts = newRow.insertCell()
          ts.textContent = region["Ts"];
          var te = newRow.insertCell();
          te.textContent = region["Te"];
        }
        // Offer to reduce it down if it's too long
        if(regions.length > MAX_REGIONS) {
          var newRow = noisefreeView.tableElem.insertRow();
          var toolong = newRow.insertCell()
          toolong.colSpan = 2;            
          toolong.className = "regions-contract";
          toolong.textContent = "More than 5 results. Click here to hide this list.";
          toolong.addEventListener('click', function() {
              model.showAllRegionsToggle = false;
              noisefreeView.render();
          })
        }
      }

      if(model.is_not_example) {
        if(regions.length == 0) {
          this.downloadBtn.disabled = true;
          this.downloadError.textContent = "No regions selected.";

        } else if(regions.length == 1 && regions[0]["Ts"] == 0 && regions[0]["Te"] == octopus.getFileLength()) {
          this.downloadBtn.disabled = true;
          this.downloadError.textContent = "Whole file selected, adjust the threshold to enable downloading.";

        } else {
          this.downloadBtn.disabled = true;
          this.downloadError.textContent = "";
        }
      }
    }
  }

  // Initialise the lot
  $(document).ready(function() {
    octopus.init();

    $('form#output').submit(function() {
      // Clean up the output
      regions = octopus.getNoiseFreeRegions();
      var clean = [];
      for(i = 0; i < regions.length; i++) {
        clean[i] = {  "s": regions[i]["Ts"],
                      "e": regions[i]["Te"] ,
                   }
      };
      document.getElementById("regions").value = JSON.stringify(clean);
      return true; // return false to cancel form action
    });

    $('#global-stats #toggle').click(function() {
      $('.snr').toggle();
      $('.pc').toggle();
    })

    $('#feedback').on('submit', function(event) {
      // Stop the default event, eg redirect
      event.preventDefault();
      $.ajax({
        // Send this to our feedback/* route
        url: '/feedback/' + model.validationstring,
        datatype: 'json',
        type: 'POST',
        // Serialise all the parameters
        data: $(event.target).serialize(),
        accepts: "application/json",
        success: function(json) {
          alert("Thanks for the feedback!");
        }
      })
    })
  });

});