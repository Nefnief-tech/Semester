/**
 * School holidays (Schulferien) per Bundesland and calendar year.
 *
 * GENERATED FILE — regenerate with `node scripts/generate-holidays.mjs`
 * (source: mehr-schulferien.de API, which publishes the Kultusministerium
 * decisions). Inclusive yyyy-MM-dd dates; one range per holiday period. A
 * period spanning New Year appears in both calendar years as its halves.
 */

export interface FerienRange {
  /** capitalized period name, e.g. "Herbstferien" */
  name: string;
  /** inclusive yyyy-MM-dd */
  start: string;
  /** inclusive yyyy-MM-dd */
  end: string;
}

export const FERIEN_DATA_VERSION = "2026-10-07";

export const FERIEN: Record<string, Record<string, FerienRange[]>> = {
  "BW": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-26",
        "end": "2026-10-30"
      },
      {
        "name": "Herbstferien",
        "start": "2026-10-31",
        "end": "2026-10-31"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-23",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-09"
      },
      {
        "name": "Osterferien",
        "start": "2027-02-08",
        "end": "2027-02-12"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-25",
        "end": "2027-03-25"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-30",
        "end": "2027-04-03"
      },
      {
        "name": "Himmelfahrt/Pfingstenferien",
        "start": "2027-05-18",
        "end": "2027-05-29"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-29",
        "end": "2027-09-11"
      }
    ]
  },
  "BY": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-11-02",
        "end": "2026-11-06"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-24",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-08"
      },
      {
        "name": "Frühjahrsferien",
        "start": "2027-02-08",
        "end": "2027-02-12"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-22",
        "end": "2027-04-02"
      },
      {
        "name": "Himmelfahrt/Pfingstenferien",
        "start": "2027-05-18",
        "end": "2027-05-28"
      },
      {
        "name": "Sommerferien",
        "start": "2027-08-02",
        "end": "2027-09-13"
      }
    ]
  },
  "BE": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-19",
        "end": "2026-10-31"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-23",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-02"
      },
      {
        "name": "Winterferien",
        "start": "2027-02-01",
        "end": "2027-02-06"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-22",
        "end": "2027-04-02"
      },
      {
        "name": "Himmelfahrtferien",
        "start": "2027-05-07",
        "end": "2027-05-07"
      },
      {
        "name": "Pfingstferien",
        "start": "2027-05-18",
        "end": "2027-05-19"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-01",
        "end": "2027-08-14"
      }
    ]
  },
  "BB": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-19",
        "end": "2026-10-30"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-23",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-02"
      },
      {
        "name": "Winterferien",
        "start": "2027-02-01",
        "end": "2027-02-06"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-22",
        "end": "2027-04-03"
      },
      {
        "name": "Pfingstferien",
        "start": "2027-05-18",
        "end": "2027-05-18"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-01",
        "end": "2027-08-14"
      }
    ]
  },
  "HB": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-12",
        "end": "2026-10-24"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-23",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-09"
      },
      {
        "name": "Winterferien",
        "start": "2027-02-01",
        "end": "2027-02-02"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-22",
        "end": "2027-04-03"
      },
      {
        "name": "Himmelfahrtferien",
        "start": "2027-05-07",
        "end": "2027-05-07"
      },
      {
        "name": "Pfingstferien",
        "start": "2027-05-18",
        "end": "2027-05-18"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-08",
        "end": "2027-08-18"
      }
    ]
  },
  "HH": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-19",
        "end": "2026-10-30"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-21",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-01"
      },
      {
        "name": "Winterferien",
        "start": "2027-01-29",
        "end": "2027-01-29"
      },
      {
        "name": "Frühjahrsferien",
        "start": "2027-03-01",
        "end": "2027-03-12"
      },
      {
        "name": "Himmelfahrtferien",
        "start": "2027-05-07",
        "end": "2027-05-14"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-01",
        "end": "2027-08-11"
      }
    ]
  },
  "HE": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-05",
        "end": "2026-10-17"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-23",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-12"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-22",
        "end": "2027-04-02"
      },
      {
        "name": "Sommerferien",
        "start": "2027-06-28",
        "end": "2027-08-06"
      },
      {
        "name": "Herbstferien",
        "start": "2027-10-04",
        "end": "2027-10-16"
      }
    ]
  },
  "MV": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-15",
        "end": "2026-10-24"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-21",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-02"
      },
      {
        "name": "Winterferien",
        "start": "2027-02-08",
        "end": "2027-02-19"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-24",
        "end": "2027-04-02"
      },
      {
        "name": "Himmelfahrtferien",
        "start": "2027-05-07",
        "end": "2027-05-07"
      },
      {
        "name": "Pfingstferien",
        "start": "2027-05-14",
        "end": "2027-05-18"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-05",
        "end": "2027-08-14"
      }
    ]
  },
  "NI": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-12",
        "end": "2026-10-24"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-23",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-09"
      },
      {
        "name": "Winterferien",
        "start": "2027-02-01",
        "end": "2027-02-02"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-22",
        "end": "2027-04-03"
      },
      {
        "name": "Himmelfahrtferien",
        "start": "2027-05-07",
        "end": "2027-05-07"
      },
      {
        "name": "Pfingstferien",
        "start": "2027-05-18",
        "end": "2027-05-18"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-08",
        "end": "2027-08-18"
      }
    ]
  },
  "NW": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-17",
        "end": "2026-10-31"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-23",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-06"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-22",
        "end": "2027-04-03"
      },
      {
        "name": "Pfingstferien",
        "start": "2027-05-18",
        "end": "2027-05-18"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-19",
        "end": "2027-08-31"
      }
    ]
  },
  "RP": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-05",
        "end": "2026-10-16"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-23",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-08"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-22",
        "end": "2027-04-02"
      },
      {
        "name": "Sommerferien",
        "start": "2027-06-28",
        "end": "2027-08-06"
      },
      {
        "name": "Herbstferien",
        "start": "2027-10-04",
        "end": "2027-10-15"
      }
    ]
  },
  "SL": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-05",
        "end": "2026-10-16"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-21",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Winterferien",
        "start": "2027-02-08",
        "end": "2027-02-12"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-30",
        "end": "2027-04-09"
      },
      {
        "name": "Sommerferien",
        "start": "2027-06-28",
        "end": "2027-08-06"
      },
      {
        "name": "Herbstferien",
        "start": "2027-10-04",
        "end": "2027-10-15"
      }
    ]
  },
  "SN": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-12",
        "end": "2026-10-24"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-23",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-02"
      },
      {
        "name": "Winterferien",
        "start": "2027-02-08",
        "end": "2027-02-19"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-26",
        "end": "2027-04-02"
      },
      {
        "name": "Himmelfahrtferien",
        "start": "2027-05-07",
        "end": "2027-05-07"
      },
      {
        "name": "Pfingstferien",
        "start": "2027-05-15",
        "end": "2027-05-18"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-10",
        "end": "2027-08-20"
      }
    ]
  },
  "ST": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-19",
        "end": "2026-10-30"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-21",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-02"
      },
      {
        "name": "Winterferien",
        "start": "2027-02-01",
        "end": "2027-02-06"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-22",
        "end": "2027-03-27"
      },
      {
        "name": "Himmelfahrt/Pfingstenferien",
        "start": "2027-05-15",
        "end": "2027-05-22"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-10",
        "end": "2027-08-20"
      }
    ]
  },
  "SH": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-12",
        "end": "2026-10-24"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-21",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-06"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-30",
        "end": "2027-04-10"
      },
      {
        "name": "Himmelfahrtferien",
        "start": "2027-05-07",
        "end": "2027-05-07"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-03",
        "end": "2027-08-14"
      }
    ]
  },
  "TH": {
    "2026": [
      {
        "name": "Herbstferien",
        "start": "2026-10-12",
        "end": "2026-10-24"
      },
      {
        "name": "Weihnachtsferien",
        "start": "2026-12-23",
        "end": "2026-12-31"
      }
    ],
    "2027": [
      {
        "name": "Weihnachtsferien",
        "start": "2027-01-01",
        "end": "2027-01-02"
      },
      {
        "name": "Winterferien",
        "start": "2027-02-01",
        "end": "2027-02-06"
      },
      {
        "name": "Osterferien",
        "start": "2027-03-22",
        "end": "2027-04-03"
      },
      {
        "name": "Himmelfahrtferien",
        "start": "2027-05-07",
        "end": "2027-05-07"
      },
      {
        "name": "Sommerferien",
        "start": "2027-07-10",
        "end": "2027-08-20"
      }
    ]
  }
};
