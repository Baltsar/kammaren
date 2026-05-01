# Swedish AB Regulatory Profile Schema and Matching Specification

This document is the source-of-truth profile model for a Swedish regulatory notification API targeting small and medium-sized aktiebolag. It is built around deterministic matching: a notification is shown only when event metadata can be matched to company attributes through explicit boolean predicates, thresholds, registrations, sector codes or known obligations. The core evidence base is official guidance and legislation from Skatteverket, Bolagsverket, Riksdagen, BFN, IMY, Försäkringskassan, Arbetsmiljöverket, Migrationsverket, SCB, PTS/MSB/MCF and Verksamt, with FAR/Srf used only as professional validation and newsletter-source inputs.

## profile_schema

Skatteverket determines VAT reporting frequency from beskattningsunderlag: högst 1 MSEK can report annually, högst 40 MSEK can report quarterly, and over 40 MSEK must report monthly ([Skatteverket moms deadlines](https://www.skatteverket.se/foretag/moms/deklareramoms/narskajagdeklareramoms.4.6d02084411db6e252fe80008988.html)). ÅRL classifies större företag by a two-of-three test over the two latest financial years: more than 50 employees, more than 40 MSEK balance-sheet total, and more than 80 MSEK net revenue, with listed companies also treated as större företag ([Årsredovisningslagen](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arsredovisningslag-19951554_sfs-1995-1554/)). Revisionsplikt for AB uses the lower two-of-three threshold: more than 3 employees, more than 1.5 MSEK balance-sheet total, and more than 3 MSEK net revenue over the two latest financial years ([Bolagsverket revisor](https://bolagsverket.se/foretag/aktiebolag/startaaktiebolag/revisoriaktiebolag.521.html)).

The JSON Schema uses JSON Schema 2020-12 plus custom metadata keys. Every field carries `description` in Swedish, an example, `x_required_during_onboarding`, `x_gates`, and `x_derivable_from`. Fields that are not needed in the initial Telegram onboarding default to safe neutral values and can be filled later from Bolagsverket, Skatteverket, SNI, website analysis, voice transcript, or follow-up questions.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:gustaf:swedish-ab-regulatory-profile:v1.0.0",
  "title": "Swedish AB Regulatory Notification Profile",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "company_identity",
    "business_activity",
    "tax_profile",
    "accounting_reporting_profile",
    "employment_profile",
    "gdpr_profile",
    "workplace_safety_profile",
    "cyber_nis2_profile",
    "meta"
  ],
  "properties": {
    "company_identity": {
      "type": "object",
      "description": "Bolagsidentitet och registerfakta.",
      "additionalProperties": false,
      "required": [
        "company_registration_number"
      ],
      "properties": {
        "company_registration_number": {
          "type": "string",
          "description": "Organisationsnummer i formatet XXXXXX-XXXX.",
          "examples": [
            "559123-4567"
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "all"
          ],
          "x_derivable_from": [
            "user_question",
            "bolagsverket_lookup"
          ],
          "pattern": "^\\d{6}-\\d{4}$"
        },
        "company_name": {
          "type": "string",
          "description": "Registrerat företagsnamn.",
          "examples": [
            "Exempelbolaget AB"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "all"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "website"
          ],
          "default": ""
        },
        "company_form": {
          "type": "string",
          "description": "Juridisk form. Primärt mål är AB men fältet stödjer filial, HB, KB och EF för filtrering.",
          "examples": [
            "ab"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "bolagsverket",
            "bfn",
            "skatteverket"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": "ab",
          "enum": [
            "ab",
            "publikt_ab",
            "filial",
            "hb",
            "kb",
            "enskild_firma",
            "ekonomisk_forening",
            "other"
          ]
        },
        "company_type": {
          "type": "string",
          "description": "Privat eller publikt aktiebolag.",
          "examples": [
            "privat_ab"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "bolagsverket",
            "revisionsplikt",
            "board_requirements",
            "k_regelverk"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": "privat_ab",
          "enum": [
            "privat_ab",
            "publikt_ab",
            "not_applicable"
          ]
        },
        "registration_date": {
          "type": "string",
          "description": "Registreringsdatum hos Bolagsverket.",
          "examples": [
            "2021-04-15"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "bolagsverket",
            "revisionsplikt"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": "1970-01-01",
          "format": "date"
        },
        "lifecycle_status": {
          "type": "string",
          "description": "Bolagets status: aktivt, vilande, likvidation eller konkurs.",
          "examples": [
            "active"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "bolagsverket",
            "skatteverket"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": "active",
          "enum": [
            "active",
            "dormant",
            "in_liquidation",
            "bankrupt",
            "under_formation"
          ]
        },
        "share_capital_sek": {
          "type": "number",
          "description": "Aktiekapital i SEK. Privat AB kräver minst 25 000 kr och publikt AB minst 500 000 kr.",
          "examples": [
            25000
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "company_type",
            "bolagsverket"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": 25000,
          "minimum": 0,
          "x_source_urls": [
            "https://bolagsverket.se/foretag/aktiebolag/startaaktiebolag/privatellerpubliktaktiebolag.527.html"
          ]
        },
        "registered_county": {
          "type": "string",
          "description": "Registrerat säte eller län.",
          "examples": [
            "Stockholms län"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "bolagsverket"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": ""
        },
        "website_url": {
          "type": "string",
          "description": "Bolagets webbplats för inferens av verksamhet, målgrupp och databehandling.",
          "examples": [
            "https://example.se"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "inference"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": "",
          "format": "uri"
        }
      }
    },
    "business_activity": {
      "type": "object",
      "description": "Verksamhetsbeskrivning, SNI och reglerade aktiviteter.",
      "additionalProperties": false,
      "required": [],
      "properties": {
        "business_description": {
          "type": "string",
          "description": "Kort beskrivning av vad bolaget gör. Används för att föreslå SNI och riskkategorier.",
          "examples": [
            "SaaS-plattform för bokning av hantverkare."
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "sni",
            "nis2",
            "vat",
            "gdpr",
            "arbetsmiljo",
            "kollektivavtal"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question"
          ],
          "default": ""
        },
        "sni_codes": {
          "type": "array",
          "description": "Registrerade SNI-koder.",
          "examples": [
            [
              {
                "code": "62010",
                "description_sv": "Dataprogrammering",
                "is_primary": true
              }
            ]
          ],
          "default": [],
          "x_required_during_onboarding": false,
          "x_gates": [
            "industry",
            "nis2",
            "kollektivavtal",
            "excise",
            "workplace_safety"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "bolagsverket_lookup",
            "website"
          ],
          "items": {
            "$ref": "#/$defs/sni_code_entry"
          }
        },
        "primary_sni_section": {
          "type": "string",
          "description": "Huvudsaklig SNI-avdelning A-V enligt SNI 2025/SNI 2007.",
          "examples": [
            "J"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "industry",
            "nis2",
            "kollektivavtal"
          ],
          "x_derivable_from": [
            "sni_lookup"
          ],
          "default": "unknown",
          "enum": [
            "A",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J",
            "K",
            "L",
            "M",
            "N",
            "O",
            "P",
            "Q",
            "R",
            "S",
            "T",
            "U",
            "V",
            "unknown"
          ],
          "x_source_urls": [
            "https://www.scb.se/dokumentation/klassifikationer-och-standarder/standard-for-svensk-naringsgrensindelning-sni/"
          ]
        },
        "high_level_sector": {
          "type": "string",
          "description": "Hög nivå av bransch för onboarding och matchning.",
          "examples": [
            "information_communication"
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "nis2",
            "bfn",
            "arbetsmiljo",
            "kollektivavtal"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question",
            "sni_lookup"
          ],
          "default": "unknown",
          "enum": [
            "agriculture_forestry_fishing",
            "mining",
            "manufacturing",
            "energy",
            "water_waste",
            "construction",
            "trade",
            "transport",
            "hospitality",
            "information_communication",
            "financial_insurance",
            "real_estate",
            "professional_services",
            "staffing_support",
            "education",
            "healthcare_social",
            "culture_recreation",
            "other_services",
            "unknown"
          ]
        },
        "regulated_activities": {
          "type": "array",
          "description": "Reglerade verksamheter som kan utlösa tillstånd, punktskatt eller särskild rapportering.",
          "examples": [
            [
              "platform_operator",
              "digital_infrastructure"
            ]
          ],
          "default": [],
          "x_required_during_onboarding": true,
          "x_gates": [
            "excise",
            "fi",
            "fmi",
            "dac7",
            "nis2",
            "arbetsmiljo"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question",
            "sni_lookup"
          ],
          "items": {
            "type": "string",
            "enum": [
              "alcohol",
              "tobacco",
              "fuel_energy",
              "gambling",
              "taxable_electronics",
              "waste_facility",
              "natural_gravel",
              "pesticides",
              "financial_services",
              "insurance",
              "real_estate_brokerage",
              "healthcare",
              "education",
              "construction",
              "platform_operator",
              "digital_infrastructure",
              "cloud_or_datacenter",
              "food",
              "chemicals",
              "none_unknown"
            ]
          }
        },
        "operates_physical_premises": {
          "type": "boolean",
          "description": "Har bolaget lokal, lager, butik, verkstad, byggarbetsplats eller annat fysiskt arbetsställe.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "arbetsmiljo",
            "workplace_type"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question"
          ],
          "default": false
        }
      }
    },
    "tax_profile": {
      "type": "object",
      "description": "Skatteverket: moms, F-skatt, arbetsgivare, internationell handel, punktskatter och DAC7.",
      "additionalProperties": false,
      "required": [],
      "properties": {
        "has_f_skatt": {
          "type": "boolean",
          "description": "Har bolaget F-skatt. För svenska AB är F-skatt normal huvudregel.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "skatteverket",
            "f_skatt"
          ],
          "x_derivable_from": [
            "skatteverket_lookup",
            "bolagsverket_lookup"
          ],
          "default": true,
          "x_source_urls": [
            "https://skatteverket.se/foretag/drivaforetag/startaochregistrera/fochfaskatt.4.58d555751259e4d661680006355.html"
          ]
        },
        "is_vat_registered": {
          "type": "boolean",
          "description": "Är bolaget momsregistrerat.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "vat",
            "moms"
          ],
          "x_derivable_from": [
            "skatteverket_lookup",
            "user_question"
          ],
          "default": false
        },
        "annual_taxable_turnover_sek": {
          "type": "number",
          "description": "Årlig momspliktig omsättning i SEK. Över 120 000 kr utlöser momsregistrering om verksamheten är momspliktig.",
          "examples": [
            850000
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "vat_registration"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question",
            "voice_transcript"
          ],
          "default": 0,
          "minimum": 0,
          "x_source_urls": [
            "https://skatteverket.se/foretag/moms/momsregistrering/registreradittforetagformoms.4.deeebd105a602bfe38000256.html"
          ]
        },
        "activity_vat_status": {
          "type": "string",
          "description": "Om huvudverksamheten är momspliktig, momsfri eller blandad.",
          "examples": [
            "taxable"
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "vat_registration",
            "vat_exempt_sector"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "website",
            "user_question"
          ],
          "default": "unknown",
          "enum": [
            "taxable",
            "exempt",
            "mixed",
            "unknown"
          ]
        },
        "vat_taxable_base_sek": {
          "type": "number",
          "description": "Beskattningsunderlag exklusive moms för att avgöra redovisningsperiod.",
          "examples": [
            850000
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "vat_reporting_frequency"
          ],
          "x_derivable_from": [
            "user_question",
            "bolagsverket_lookup"
          ],
          "default": 0,
          "minimum": 0
        },
        "vat_reporting_frequency": {
          "type": "string",
          "description": "Momsredovisningsperiod: årsvis, kvartalsvis eller månadsvis. Över 40 MSEK beskattningsunderlag innebär månadsvis redovisning.",
          "examples": [
            "quarterly"
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "vat_deadlines"
          ],
          "x_derivable_from": [
            "skatteverket_lookup",
            "user_question"
          ],
          "default": "unknown",
          "enum": [
            "annual",
            "quarterly",
            "monthly",
            "unknown"
          ],
          "x_source_urls": [
            "https://www.skatteverket.se/foretag/moms/deklareramoms/narskajagdeklareramoms.4.6d02084411db6e252fe80008988.html"
          ]
        },
        "vat_accounting_method": {
          "type": "string",
          "description": "Momsredovisningsmetod: faktureringsmetoden eller bokslutsmetoden.",
          "examples": [
            "invoice_method"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "vat_deadlines"
          ],
          "x_derivable_from": [
            "user_question",
            "skatteverket_lookup"
          ],
          "default": "unknown",
          "enum": [
            "invoice_method",
            "cash_method",
            "unknown"
          ]
        },
        "has_eu_trade": {
          "type": "boolean",
          "description": "Har bolaget handel med andra EU-länder.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "vat",
            "periodisk_sammanstallning",
            "oss"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question"
          ],
          "default": false
        },
        "eu_goods_purchases_sek": {
          "type": "number",
          "description": "Unionsinterna varuförvärv per år i SEK. Över 90 000 kr kan utlösa momsregistrering även vid låg omsättning.",
          "examples": [
            120000
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "vat_registration"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": 0,
          "minimum": 0,
          "x_source_urls": [
            "https://skatteverket.se/foretag/moms/momsregistrering/registreradittforetagformoms.4.deeebd105a602bfe38000256.html"
          ]
        },
        "buys_b2b_services_from_abroad": {
          "type": "boolean",
          "description": "Köper bolaget B2B-tjänster från utländska beskattningsbara personer.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "vat_reverse_charge"
          ],
          "x_derivable_from": [
            "user_question",
            "website"
          ],
          "default": false
        },
        "sells_goods_to_eu_businesses": {
          "type": "boolean",
          "description": "Säljer bolaget varor till momsregistrerade företag i EU.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "periodisk_sammanstallning"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false
        },
        "sells_services_to_eu_businesses": {
          "type": "boolean",
          "description": "Säljer bolaget tjänster till momsregistrerade företag i EU.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "periodisk_sammanstallning"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false
        },
        "sells_to_eu_consumers_b2c": {
          "type": "boolean",
          "description": "Säljer bolaget varor eller digitala tjänster till privatpersoner i andra EU-länder.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "oss"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false
        },
        "annual_eu_b2c_turnover_sek": {
          "type": "number",
          "description": "EU-gränsöverskridande B2C-försäljning. Över 10 000 EUR innebär OSS eller lokal momsregistrering.",
          "examples": [
            150000
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "oss"
          ],
          "x_derivable_from": [
            "user_question",
            "website"
          ],
          "default": 0,
          "minimum": 0,
          "x_source_urls": [
            "https://www.skatteverket.se/foretag/moms/deklareramoms/ansokomattredovisadistansforsaljningionestopshoposs.4.5b35a6251761e691420b58e.html"
          ]
        },
        "imports_from_third_countries": {
          "type": "boolean",
          "description": "Importerar bolaget varor från land utanför EU.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "customs_vat"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false
        },
        "exports_to_third_countries": {
          "type": "boolean",
          "description": "Exporter bolaget varor eller tjänster till land utanför EU.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "export_vat",
            "customs"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false
        },
        "is_employer_registered": {
          "type": "boolean",
          "description": "Är bolaget registrerat som arbetsgivare hos Skatteverket.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "arbetsgivare",
            "agi",
            "forsakringskassan"
          ],
          "x_derivable_from": [
            "skatteverket_lookup",
            "user_question"
          ],
          "default": false
        },
        "pays_salary_to_owner": {
          "type": "boolean",
          "description": "Betalar bolaget lön till ägare eller företagsledare.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "arbetsgivare",
            "agi",
            "3_12"
          ],
          "x_derivable_from": [
            "user_question",
            "voice_transcript"
          ],
          "default": false
        },
        "is_platform_operator": {
          "type": "boolean",
          "description": "Driver bolaget en digital plattform som förmedlar varor, personliga tjänster, transportuthyrning eller fastighetsuthyrning åt säljare.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "dac7"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.skatteverket.se/foretag/skatterochavdrag/kontrolluppgifter/kontrolluppgifterfranplattformsoperatorerku90ku91ku92ochku93.4.21e4ba96188260715e3109.html"
          ]
        },
        "platform_activity_types": {
          "type": "array",
          "description": "DAC7-aktiviteter: KU90 personliga tjänster, KU91 varor, KU92 transportmedel, KU93 fast egendom.",
          "examples": [
            [
              "personal_services",
              "goods_sales"
            ]
          ],
          "default": [],
          "x_required_during_onboarding": false,
          "x_gates": [
            "dac7"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "items": {
            "type": "string",
            "enum": [
              "personal_services",
              "goods_sales",
              "transport_rental",
              "real_estate_rental"
            ]
          }
        },
        "platform_nexus_sweden": {
          "type": "boolean",
          "description": "Har plattformen rapporteringsgrund i Sverige genom hemvist, registrering, ledning eller fast driftställe.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "dac7"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": false
        },
        "has_dac7_exemption": {
          "type": "boolean",
          "description": "Har bolaget beviljat undantag eller saknar rapporteringspliktiga säljare.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "dac7"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "excise_tax_categories": {
          "type": "array",
          "description": "Punktskattekategorier som träffar bolaget.",
          "examples": [
            [
              "energy_fuel_tax"
            ]
          ],
          "default": [],
          "x_required_during_onboarding": false,
          "x_gates": [
            "excise_tax"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "website",
            "user_question"
          ],
          "items": {
            "type": "string",
            "enum": [
              "alcohol_tax",
              "tobacco_tax",
              "energy_fuel_tax",
              "gambling_tax",
              "chemical_tax_electronics",
              "waste_tax",
              "natural_gravel_tax",
              "pesticide_tax"
            ]
          }
        }
      }
    },
    "accounting_reporting_profile": {
      "type": "object",
      "description": "Bolagsverket, ÅRL, revisionsplikt, BFN och räkenskapsår.",
      "additionalProperties": false,
      "required": [],
      "properties": {
        "fiscal_year_start_month": {
          "type": "integer",
          "description": "Räkenskapsårets startmånad, 1-12.",
          "examples": [
            1
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "fiscal_year",
            "vat_deadlines",
            "annual_report_deadline"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 1,
          "minimum": 1,
          "maximum": 12
        },
        "fiscal_year_end_month": {
          "type": "integer",
          "description": "Räkenskapsårets slutmånad, 1-12.",
          "examples": [
            12
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "fiscal_year",
            "vat_deadlines",
            "annual_report_deadline"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 12,
          "minimum": 1,
          "maximum": 12,
          "x_source_urls": [
            "https://bolagsverket.se/foretag/aktiebolag/drivaaktiebolag/andrarakenskapsarforaktiebolag.581.html"
          ]
        },
        "avg_employees_year_1": {
          "type": "number",
          "description": "Medelantal anställda senaste räkenskapsåret.",
          "examples": [
            4
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "arl_size",
            "revisionsplikt",
            "nis2",
            "arbetsmiljo"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 0,
          "minimum": 0
        },
        "avg_employees_year_2": {
          "type": "number",
          "description": "Medelantal anställda föregående räkenskapsår.",
          "examples": [
            4
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "arl_size",
            "revisionsplikt"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 0,
          "minimum": 0
        },
        "net_revenue_sek_year_1": {
          "type": "number",
          "description": "Nettoomsättning senaste räkenskapsåret.",
          "examples": [
            4200000
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "arl_size",
            "revisionsplikt",
            "sustainability",
            "nis2"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 0,
          "minimum": 0
        },
        "net_revenue_sek_year_2": {
          "type": "number",
          "description": "Nettoomsättning föregående räkenskapsår.",
          "examples": [
            3900000
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "arl_size",
            "revisionsplikt"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 0,
          "minimum": 0
        },
        "balance_sheet_total_sek_year_1": {
          "type": "number",
          "description": "Balansomslutning senaste räkenskapsåret.",
          "examples": [
            1800000
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "arl_size",
            "revisionsplikt",
            "nis2"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 0,
          "minimum": 0
        },
        "balance_sheet_total_sek_year_2": {
          "type": "number",
          "description": "Balansomslutning föregående räkenskapsår.",
          "examples": [
            1600000
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "arl_size",
            "revisionsplikt"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 0,
          "minimum": 0
        },
        "is_publicly_listed": {
          "type": "boolean",
          "description": "Har bolaget överlåtbara värdepapper upptagna till handel på reglerad marknad eller motsvarande.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "arl_size",
            "k4",
            "sustainability",
            "audit"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arsredovisningslag-19951554_sfs-1995-1554/"
          ]
        },
        "listing_venue": {
          "type": "string",
          "description": "Handelsplats eller marknad om bolaget är noterat.",
          "examples": [
            "Nasdaq Stockholm"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "listed_company"
          ],
          "x_derivable_from": [
            "user_question",
            "bolagsverket_lookup"
          ],
          "default": ""
        },
        "computed_arl_size_class": {
          "type": "string",
          "description": "Beräknad ÅRL-klass: större företag om mer än ett av 50 anställda, 40 MSEK balansomslutning och 80 MSEK nettoomsättning uppfylls två år i rad, eller om noterat.",
          "examples": [
            "mindre_foretag"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "arl_size",
            "bfn",
            "audit"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": "unknown",
          "enum": [
            "mindre_foretag",
            "storre_foretag",
            "unknown"
          ],
          "readOnly": true,
          "x_source_urls": [
            "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arsredovisningslag-19951554_sfs-1995-1554/"
          ]
        },
        "requires_auditor": {
          "type": "boolean",
          "description": "Beräknad revisionsplikt: mer än ett av 3 anställda, 1,5 MSEK balansomslutning och 3 MSEK nettoomsättning under två senaste räkenskapsår, eller alltid för publikt AB och vissa finansiella bolag.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "revisionsplikt"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": false,
          "readOnly": true,
          "x_source_urls": [
            "https://bolagsverket.se/foretag/aktiebolag/startaaktiebolag/revisoriaktiebolag.521.html"
          ]
        },
        "auditor_appointed": {
          "type": "boolean",
          "description": "Har bolaget registrerad revisor.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "revisionsplikt"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": false
        },
        "accounting_framework": {
          "type": "string",
          "description": "Tillämpat K-regelverk eller specialregim.",
          "examples": [
            "k2"
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "bfn",
            "annual_report"
          ],
          "x_derivable_from": [
            "user_question",
            "bolagsverket_lookup"
          ],
          "default": "unknown",
          "enum": [
            "k1",
            "k2",
            "k3",
            "k4_ifrs",
            "arkl",
            "arfl",
            "unknown"
          ]
        },
        "has_foreign_filial": {
          "type": "boolean",
          "description": "Har bolaget filial i utlandet. Från K2/K3-ändringar kan utländsk filial påverka K2-behörighet.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "k2_k3"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.bfn.se/andrat-tillampningsomrade-for-k2-arsredovisning-for-mindre-foretag/"
          ]
        },
        "has_crypto_assets": {
          "type": "boolean",
          "description": "Har eller har haft kryptotillgångar annat än enstaka betalningsmottagande.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "k2_k3"
          ],
          "x_derivable_from": [
            "user_question",
            "voice_transcript"
          ],
          "default": false
        },
        "has_share_based_payments": {
          "type": "boolean",
          "description": "Har bolaget förvärvat varor eller tjänster mot aktierelaterade ersättningar, exempelvis incitamentsprogram.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "k2_k3"
          ],
          "x_derivable_from": [
            "user_question",
            "voice_transcript"
          ],
          "default": false
        },
        "has_convertible_or_equity_settled_debt": {
          "type": "boolean",
          "description": "Har bolaget emitterade skuldebrev som kan regleras med egetkapitalinstrument.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "k2_k3"
          ],
          "x_derivable_from": [
            "user_question",
            "bolagsverket_lookup"
          ],
          "default": false
        },
        "building_revenue_share_pct": {
          "type": "number",
          "description": "Andel av nettoomsättning som normalt genereras av byggnader. Minst 75 procent kan stoppa K2 för bolag över lättnadsgränsen.",
          "examples": [
            80
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "k2_k3",
            "real_estate"
          ],
          "x_derivable_from": [
            "user_question",
            "sni_lookup"
          ],
          "default": 0,
          "minimum": 0,
          "maximum": 100,
          "x_source_urls": [
            "https://www.bfn.se/fragor-och-svar/andringar-i-k2-och-k3-fran-2026/"
          ]
        },
        "has_material_deferred_tax_liability": {
          "type": "boolean",
          "description": "Har bolaget väsentlig uppskjuten skatteskuld.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "k2_k3"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "is_part_of_group": {
          "type": "boolean",
          "description": "Ingår bolaget i en koncern.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "group",
            "arl_size",
            "nis2"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": false
        },
        "is_parent_company": {
          "type": "boolean",
          "description": "Är bolaget moderföretag.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "koncernredovisning",
            "bfn"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": false
        },
        "group_exemption_type": {
          "type": "string",
          "description": "Undantag från koncernredovisning om relevant.",
          "examples": [
            "minor_group"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "koncernredovisning"
          ],
          "x_derivable_from": [
            "user_question",
            "bolagsverket_lookup"
          ],
          "default": "none",
          "enum": [
            "none",
            "minor_group",
            "ees_parent_consolidates",
            "subsidiaries_immaterial",
            "unknown"
          ]
        },
        "sustainability_reporting_scope": {
          "type": "string",
          "description": "CSRD/ÅRL-hållbarhetsrapporteringens uppskattade scope.",
          "examples": [
            "out_of_scope"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "sustainability_reporting"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": "out_of_scope",
          "enum": [
            "out_of_scope",
            "listed_small",
            "large_non_listed",
            "group_scope",
            "unknown"
          ]
        }
      }
    },
    "governance_profile": {
      "type": "object",
      "description": "Styrelse, VD, bosättningskrav och verklig huvudman.",
      "additionalProperties": false,
      "required": [],
      "properties": {
        "board_member_count": {
          "type": "integer",
          "description": "Antal styrelseledamöter. Publikt AB kräver minst tre.",
          "examples": [
            2
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "board_requirements"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": 0,
          "minimum": 0
        },
        "deputy_board_member_count": {
          "type": "integer",
          "description": "Antal styrelsesuppleanter. Privat AB med 1-2 ledamöter behöver suppleant.",
          "examples": [
            1
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "board_requirements"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": 0,
          "minimum": 0
        },
        "ees_resident_board_member_count": {
          "type": "integer",
          "description": "Antal styrelseledamöter bosatta inom EES. Minst hälften krävs om inte dispens finns.",
          "examples": [
            2
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "board_residency"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 0,
          "minimum": 0,
          "x_source_urls": [
            "https://bolagsverket.se/foretag/aktiebolag/startaaktiebolag/styrelseochverkstallandedirektoriaktiebolag/kravpabosattningforstyrelseniettaktiebolag.509.html"
          ]
        },
        "managing_director_appointed": {
          "type": "boolean",
          "description": "Har bolaget VD. Publikt AB måste ha VD.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "board_requirements"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": false
        },
        "managing_director_ees_resident": {
          "type": "boolean",
          "description": "Är VD bosatt inom EES eller finns dispens.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "board_residency"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": false
        },
        "authorized_signatory_ees_count": {
          "type": "integer",
          "description": "Antal firmatecknare bosatta inom EES. Minst en krävs om särskild firmatecknare finns.",
          "examples": [
            1
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "board_residency"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": 0,
          "minimum": 0
        },
        "beneficial_owner_registered": {
          "type": "boolean",
          "description": "Är verklig huvudman registrerad hos Bolagsverket eller är undantag tillämpligt.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "ubo",
            "aml"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": false
        },
        "ubo_count": {
          "type": "integer",
          "description": "Antal registrerade verkliga huvudmän.",
          "examples": [
            1
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "ubo",
            "aml"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup"
          ],
          "default": 0,
          "minimum": 0
        }
      }
    },
    "employment_profile": {
      "type": "object",
      "description": "Anställda, kollektivavtal, sjuklön, VAB och internationell rekrytering.",
      "additionalProperties": false,
      "required": [],
      "properties": {
        "employee_count": {
          "type": "integer",
          "description": "Antal anställda i Sverige just nu.",
          "examples": [
            7
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "arbetsgivare",
            "forsakringskassan",
            "arbetsmiljo",
            "nis2",
            "kollektivavtal"
          ],
          "x_derivable_from": [
            "user_question",
            "bolagsverket_lookup"
          ],
          "default": 0,
          "minimum": 0
        },
        "employee_role_types": {
          "type": "array",
          "description": "Rolltyper som påverkar arbetsmiljörisker och kollektivavtal.",
          "examples": [
            [
              "developer",
              "sales"
            ]
          ],
          "default": [],
          "x_required_during_onboarding": false,
          "x_gates": [
            "arbetsmiljo",
            "kollektivavtal"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question"
          ],
          "items": {
            "type": "string",
            "enum": [
              "office",
              "developer",
              "sales",
              "warehouse",
              "driver",
              "construction_worker",
              "healthcare_worker",
              "manufacturing_operator",
              "retail_staff",
              "restaurant_staff",
              "cleaning_staff",
              "field_worker"
            ]
          }
        },
        "has_collective_agreement": {
          "type": "boolean",
          "description": "Är bolaget bundet av kollektivavtal eller hängavtal.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "kollektivavtal",
            "work_permit_salary",
            "employment_terms"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://verksamt.se/personal-rekrytering/kollektivavtal-arbetsmiljo/kollektivavtal-for-dig-som-arbetsgivare"
          ]
        },
        "collective_agreement_families": {
          "type": "array",
          "description": "Tillämpliga avtalsfamiljer.",
          "examples": [
            [
              "almega"
            ]
          ],
          "default": [],
          "x_required_during_onboarding": false,
          "x_gates": [
            "kollektivavtal",
            "migrationsverket"
          ],
          "x_derivable_from": [
            "user_question",
            "sni_lookup"
          ],
          "items": {
            "type": "string",
            "enum": [
              "almega",
              "teknikforetagen",
              "svensk_handel",
              "byggforetagen",
              "visita",
              "transportforetagen",
              "finans",
              "kommunal_private_care",
              "other",
              "unknown"
            ]
          }
        },
        "employer_organisation_member": {
          "type": "boolean",
          "description": "Är bolaget medlem i arbetsgivarorganisation som binder bolaget till centralt avtal.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "kollektivavtal"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "has_hangavtal": {
          "type": "boolean",
          "description": "Har bolaget tecknat hängavtal med facklig organisation.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "kollektivavtal"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "has_non_eu_eea_workers": {
          "type": "boolean",
          "description": "Har bolaget anställda från land utanför EU/EES som behöver eller har arbetstillstånd.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "migrationsverket",
            "work_permit"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "hires_from_outside_eu_eea": {
          "type": "boolean",
          "description": "Planerar bolaget att rekrytera från land utanför EU/EES.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "migrationsverket"
          ],
          "x_derivable_from": [
            "user_question",
            "voice_transcript"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.migrationsverket.se/arbetsgivare/sa-fungerar-det.html"
          ]
        },
        "work_permit_holders_count": {
          "type": "integer",
          "description": "Antal anställda med arbetstillstånd, EU-blåkort eller ICT-tillstånd.",
          "examples": [
            1
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "migrationsverket"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": 0,
          "minimum": 0
        },
        "uses_posted_workers": {
          "type": "boolean",
          "description": "Tar bolaget emot utstationerad arbetskraft i Sverige.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "arbetsmiljo",
            "migrationsverket",
            "kollektivavtal"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "has_parent_employees": {
          "type": "boolean",
          "description": "Finns anställda som kan använda VAB. Fältet är inte lämpligt som onboardingfråga utan fylls över tid.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "forsakringskassan_vab"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "sick_pay_process_exists": {
          "type": "boolean",
          "description": "Har bolaget process för sjuklöneperiod dag 1-14 och anmälan till Försäkringskassan.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "forsakringskassan_sjuklon"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.forsakringskassan.se/arbetsgivare/sjukdom-och-skada/sjuklon"
          ]
        }
      }
    },
    "gdpr_profile": {
      "type": "object",
      "description": "IMY/GDPR: personuppgifter, särskilda kategorier, överföringar och DPO.",
      "additionalProperties": false,
      "required": [],
      "properties": {
        "processes_personal_data": {
          "type": "boolean",
          "description": "Behandlar bolaget personuppgifter om kunder, användare, anställda eller leverantörer.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "gdpr",
            "imy"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question"
          ],
          "default": true
        },
        "controller_processor_role": {
          "type": "string",
          "description": "Bolagets huvudsakliga roll enligt GDPR.",
          "examples": [
            "controller"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "gdpr"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": "unknown",
          "enum": [
            "controller",
            "processor",
            "joint_controller",
            "both",
            "unknown"
          ]
        },
        "processes_employee_data": {
          "type": "boolean",
          "description": "Behandlar bolaget HR-, löne- eller frånvarodata om anställda.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "gdpr_employment"
          ],
          "x_derivable_from": [
            "employee_count",
            "user_question"
          ],
          "default": false
        },
        "processes_customer_data": {
          "type": "boolean",
          "description": "Behandlar bolaget personuppgifter om kunder eller användare.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "gdpr_customer"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false
        },
        "processes_children_data": {
          "type": "boolean",
          "description": "Behandlar bolaget personuppgifter om barn.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "gdpr_children",
            "vab"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/personuppgifter-om-barn/"
          ]
        },
        "information_society_service_for_minors": {
          "type": "boolean",
          "description": "Riktar bolaget digital tjänst till barn under svensk samtyckesålder enligt GDPR.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "gdpr_children"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false
        },
        "processes_special_categories": {
          "type": "boolean",
          "description": "Behandlar bolaget känsliga personuppgifter enligt GDPR artikel 9.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "gdpr_art9",
            "dpo"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/kansliga-personuppgifter/"
          ]
        },
        "special_category_types": {
          "type": "array",
          "description": "Typer av känsliga personuppgifter.",
          "examples": [
            [
              "health"
            ]
          ],
          "default": [],
          "x_required_during_onboarding": false,
          "x_gates": [
            "gdpr_art9",
            "dpo"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "items": {
            "type": "string",
            "enum": [
              "health",
              "biometric_id",
              "genetic",
              "union_membership",
              "political_opinion",
              "religion",
              "ethnic_origin",
              "sexual_orientation"
            ]
          }
        },
        "processes_criminal_data": {
          "type": "boolean",
          "description": "Behandlar bolaget uppgifter om lagöverträdelser enligt GDPR artikel 10.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "gdpr_art10",
            "dpo"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "core_activity_large_scale_monitoring": {
          "type": "boolean",
          "description": "Är regelbunden och systematisk övervakning i stor omfattning en kärnverksamhet.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "dpo"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/dataskyddsombud/"
          ]
        },
        "core_activity_large_scale_special_category_data": {
          "type": "boolean",
          "description": "Består kärnverksamheten av storskalig behandling av känsliga personuppgifter eller brottsuppgifter.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "dpo"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false
        },
        "dpo_appointed": {
          "type": "boolean",
          "description": "Har bolaget utsett dataskyddsombud.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "dpo"
          ],
          "x_derivable_from": [
            "user_question",
            "website"
          ],
          "default": false
        },
        "dpo_registered_with_imy": {
          "type": "boolean",
          "description": "Är dataskyddsombudet anmält till IMY.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "dpo"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "transfers_data_outside_eea": {
          "type": "boolean",
          "description": "Görs personuppgifter tillgängliga för mottagare utanför EU/EES.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "third_country_transfer"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/overforing-till-tredje-land/"
          ]
        },
        "transfer_mechanisms": {
          "type": "array",
          "description": "Mekanism för tredjelandsöverföring.",
          "examples": [
            [
              "scc"
            ]
          ],
          "default": [],
          "x_required_during_onboarding": false,
          "x_gates": [
            "third_country_transfer"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "items": {
            "type": "string",
            "enum": [
              "adequacy_decision",
              "scc",
              "bcr",
              "article_49_derogation",
              "eu_us_data_privacy_framework",
              "unknown"
            ]
          }
        },
        "uses_behavioral_tracking": {
          "type": "boolean",
          "description": "Använder bolaget pixlar, cookies eller spårning för profilering eller marknadsföring.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "gdpr_marketing",
            "imy"
          ],
          "x_derivable_from": [
            "website"
          ],
          "default": false
        },
        "uses_ai_profiling_or_automated_decisions": {
          "type": "boolean",
          "description": "Använder bolaget AI/profilering för beslut som påverkar personer i betydande grad.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "gdpr_dpia",
            "ai"
          ],
          "x_derivable_from": [
            "website",
            "user_question"
          ],
          "default": false
        },
        "breach_notification_process_exists": {
          "type": "boolean",
          "description": "Finns dokumenterad process för personuppgiftsincidenter och 72-timmarsanmälan.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "gdpr_incident"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        }
      }
    },
    "workplace_safety_profile": {
      "type": "object",
      "description": "Arbetsmiljöverket: SAM, arbetsställe och riskkategorier.",
      "additionalProperties": false,
      "required": [],
      "properties": {
        "workplace_types": {
          "type": "array",
          "description": "Typer av arbetsmiljö.",
          "examples": [
            [
              "office",
              "remote_only"
            ]
          ],
          "default": [
            "office"
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "arbetsmiljo",
            "risk_categories"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question",
            "sni_lookup"
          ],
          "items": {
            "type": "string",
            "enum": [
              "office",
              "remote_only",
              "retail",
              "restaurant",
              "warehouse",
              "industrial",
              "construction_site",
              "healthcare",
              "laboratory",
              "transport",
              "field_service",
              "school",
              "other"
            ]
          }
        },
        "has_written_work_environment_policy": {
          "type": "boolean",
          "description": "Finns nedskriven arbetsmiljöpolicy. Ska vara nedskriven vid minst 10 arbetstagare.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "sam"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.av.se/arbetsmiljoarbete-och-inspektioner/arbeta-med-arbetsmiljon/systematiskt-arbetsmiljoarbete/"
          ]
        },
        "has_skyddsombud": {
          "type": "boolean",
          "description": "Finns skyddsombud. Krävs normalt från 5 anställda.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "sam",
            "skyddsombud"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.av.se/en/work-environment-work-and-inspections/safety-representatives/"
          ]
        },
        "has_skyddskommitte": {
          "type": "boolean",
          "description": "Finns skyddskommitté. Krävs normalt från 50 anställda.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "sam",
            "skyddskommitte"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "risk_categories": {
          "type": "array",
          "description": "Arbetsmiljörisker som träffar särskilda föreskrifter.",
          "examples": [
            [
              "work_at_height",
              "construction"
            ]
          ],
          "default": [],
          "x_required_during_onboarding": true,
          "x_gates": [
            "arbetsmiljo"
          ],
          "x_derivable_from": [
            "website",
            "voice_transcript",
            "user_question",
            "sni_lookup"
          ],
          "items": {
            "type": "string",
            "enum": [
              "chemicals",
              "cmr_substances",
              "machinery",
              "lifting_equipment",
              "scaffolding",
              "work_at_height",
              "construction",
              "biological_agents",
              "healthcare_cytostatics",
              "explosive_atmosphere",
              "noise_vibration",
              "night_work",
              "lone_work",
              "pregnancy_risks",
              "none_unknown"
            ]
          }
        },
        "uses_chemicals_at_work": {
          "type": "boolean",
          "description": "Förekommer kemiska riskkällor i arbetet.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "chemical_risks"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "website",
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202310/"
          ]
        },
        "uses_cmr_substances": {
          "type": "boolean",
          "description": "Förekommer cancerogena, mutagena eller reproduktionsstörande ämnen.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "cmr"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "uses_machinery_or_lifting_equipment": {
          "type": "boolean",
          "description": "Använder bolaget maskiner, lyftanordningar, truckar eller liknande arbetsutrustning.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "machinery"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "website",
            "user_question"
          ],
          "default": false
        },
        "workplace_involves_work_at_height": {
          "type": "boolean",
          "description": "Förekommer arbete på höjd eller fallrisk.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "fall_risk"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "user_question"
          ],
          "default": false
        },
        "max_height_difference_metres": {
          "type": "number",
          "description": "Största nivåskillnad i meter. Minst 2 meter i byggarbete utlöser särskilda krav.",
          "examples": [
            2.5
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "fall_risk",
            "construction"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": 0,
          "minimum": 0,
          "x_source_urls": [
            "https://www.av.se/produktion-industri-och-logistik/bygg/arbetsmiljorisker-vid-byggnads--och-anlaggningsarbete/arbete-med-fallrisk/"
          ]
        },
        "is_construction_project_actor": {
          "type": "boolean",
          "description": "Är bolaget byggherre, projektör, Bas-P, Bas-U eller entreprenör i bygg- och anläggningsarbete.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "construction"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "website",
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://www.av.se/produktion-industri-och-logistik/bygg/"
          ]
        },
        "has_bas_p_appointed": {
          "type": "boolean",
          "description": "Är Bas-P utsedd i relevanta projekt.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "construction"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "has_bas_u_appointed": {
          "type": "boolean",
          "description": "Är Bas-U utsedd i relevanta projekt.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "construction"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "has_arbetsmiljoplan": {
          "type": "boolean",
          "description": "Finns arbetsmiljöplan när projektet kräver det.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "construction",
            "fall_risk"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "handles_biological_agents": {
          "type": "boolean",
          "description": "Förekommer biologiska agens, smittrisk, vård, labb, djurhållning eller liknande.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "biological_agents"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "website",
            "user_question"
          ],
          "default": false
        },
        "biological_risk_class": {
          "type": "integer",
          "description": "Högsta riskklass för biologiskt agens, 1-4. Klass 3 eller högre utlöser anmälan/tillstånd.",
          "examples": [
            2
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "biological_agents"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": 1,
          "minimum": 1,
          "maximum": 4
        }
      }
    },
    "cyber_nis2_profile": {
      "type": "object",
      "description": "NIS2/Cybersäkerhetslagen: sektorer, storlek och säkerhetskrav.",
      "additionalProperties": false,
      "required": [],
      "properties": {
        "nis2_sectors": {
          "type": "array",
          "description": "NIS2-sektorer som bolaget kan omfattas av.",
          "examples": [
            [
              "digital_infrastructure"
            ]
          ],
          "default": [],
          "x_required_during_onboarding": true,
          "x_gates": [
            "nis2"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "website",
            "user_question"
          ],
          "items": {
            "type": "string",
            "enum": [
              "energy",
              "transport",
              "banking",
              "financial_market_infrastructure",
              "healthcare",
              "drinking_water",
              "wastewater",
              "digital_infrastructure",
              "ict_service_management_b2b",
              "public_administration",
              "space",
              "postal_courier",
              "waste_management",
              "chemicals",
              "food",
              "manufacturing_medical_devices",
              "manufacturing_electronics",
              "manufacturing_machinery",
              "manufacturing_vehicles",
              "digital_provider_marketplace_search_social",
              "research",
              "none_unknown"
            ]
          }
        },
        "annual_turnover_eur": {
          "type": "number",
          "description": "Årsomsättning i EUR för NIS2-storleksbedömning.",
          "examples": [
            12000000
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "nis2_size"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 0,
          "minimum": 0
        },
        "balance_sheet_total_eur": {
          "type": "number",
          "description": "Balansomslutning i EUR för NIS2-storleksbedömning.",
          "examples": [
            11000000
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "nis2_size"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": 0,
          "minimum": 0
        },
        "group_level_size_applies": {
          "type": "boolean",
          "description": "Ska storlek bedömas på koncernnivå för NIS2.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "nis2_size"
          ],
          "x_derivable_from": [
            "bolagsverket_lookup",
            "user_question"
          ],
          "default": false
        },
        "is_digital_infrastructure_provider": {
          "type": "boolean",
          "description": "Tillhandahåller bolaget DNS, TLD, IXP, CDN, cloud, datacenter eller liknande digital infrastruktur.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": true,
          "x_gates": [
            "nis2_always_in_scope"
          ],
          "x_derivable_from": [
            "website",
            "sni_lookup",
            "user_question"
          ],
          "default": false,
          "x_source_urls": [
            "https://pts.se/nyheter-och-pressmeddelanden/pts-e-tjanst-stottar-foretag-infor-ny-cybersakerhetslag/"
          ]
        },
        "nis2_in_scope": {
          "type": "boolean",
          "description": "Beräknad träff enligt Cybersäkerhetslagen: sektor plus minst medelstort företag eller alltid-inom-scope-kategori.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "nis2"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "bolagsverket_lookup"
          ],
          "default": false,
          "readOnly": true,
          "x_source_urls": [
            "https://rib.msb.se/filer/pdf/31243.pdf",
            "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/betankande/ett-starkt-skydd-for-natverks-och_hd01f%C3%B6u2/html/"
          ]
        },
        "nis2_entity_classification": {
          "type": "string",
          "description": "Beräknad klass: väsentlig, viktig eller utanför scope.",
          "examples": [
            "important"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "nis2"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "bolagsverket_lookup"
          ],
          "default": "out_of_scope",
          "enum": [
            "essential",
            "important",
            "out_of_scope",
            "unknown"
          ],
          "readOnly": true
        },
        "nis2_registered": {
          "type": "boolean",
          "description": "Har bolaget anmält sig till relevant tillsynsmyndighet enligt Cybersäkerhetslagen.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "nis2"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "nis2_incident_reporting_procedure": {
          "type": "boolean",
          "description": "Finns process för 24h tidig varning, 72h incidentrapport och slutrapport inom en månad.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "nis2_incident"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "all_10_security_areas_documented": {
          "type": "boolean",
          "description": "Är NIS2:s tio minimiområden dokumenterade.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "nis2_security"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        },
        "management_security_training_completed": {
          "type": "boolean",
          "description": "Har ledningen genomfört cybersäkerhetsutbildning enligt NIS2-styrning.",
          "examples": [
            false
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "nis2_management"
          ],
          "x_derivable_from": [
            "user_question"
          ],
          "default": false
        }
      }
    },
    "meta": {
      "type": "object",
      "description": "Schemametadata och datakvalitet.",
      "additionalProperties": false,
      "required": [
        "schema_version"
      ],
      "properties": {
        "schema_version": {
          "type": "string",
          "description": "Schemaversion.",
          "examples": [
            "1.0.0"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "meta"
          ],
          "x_derivable_from": [
            "system"
          ],
          "default": "1.0.0"
        },
        "profile_last_updated_at": {
          "type": "string",
          "description": "Senaste profiluppdatering.",
          "examples": [
            "2026-04-30T13:02:00+02:00"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "meta"
          ],
          "x_derivable_from": [
            "system"
          ],
          "default": "1970-01-01T00:00:00Z",
          "format": "date-time"
        },
        "profile_completeness_pct": {
          "type": "number",
          "description": "Andel ifyllda relevanta fält.",
          "examples": [
            72
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "meta"
          ],
          "x_derivable_from": [
            "system"
          ],
          "default": 0,
          "minimum": 0,
          "maximum": 100
        },
        "source_confidence": {
          "type": "string",
          "description": "Datakvalitet för matchning.",
          "examples": [
            "mixed_verified_and_user_reported"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "meta"
          ],
          "x_derivable_from": [
            "system"
          ],
          "default": "unknown",
          "enum": [
            "verified_registry",
            "user_reported",
            "inferred",
            "mixed_verified_and_user_reported",
            "unknown"
          ]
        }
      }
    }
  },
  "$defs": {
    "sni_code_entry": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "is_primary"
      ],
      "properties": {
        "code": {
          "type": "string",
          "description": "SNI-kod, exempelvis 62.010 eller 41.200.",
          "examples": [
            "62.010"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "industry",
            "nis2",
            "kollektivavtal"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "bolagsverket_lookup"
          ]
        },
        "version": {
          "type": "string",
          "description": "SNI-version som koden kommer från.",
          "examples": [
            "sni_2025"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "industry"
          ],
          "x_derivable_from": [
            "sni_lookup"
          ],
          "default": "unknown",
          "enum": [
            "sni_2007",
            "sni_2025",
            "unknown"
          ]
        },
        "is_primary": {
          "type": "boolean",
          "description": "Sant om koden är huvudsaklig verksamhet.",
          "examples": [
            true
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "industry",
            "nis2",
            "kollektivavtal"
          ],
          "x_derivable_from": [
            "sni_lookup",
            "bolagsverket_lookup"
          ],
          "default": false
        },
        "description_sv": {
          "type": "string",
          "description": "SNI-benämning.",
          "examples": [
            "Dataprogrammering"
          ],
          "x_required_during_onboarding": false,
          "x_gates": [
            "industry"
          ],
          "x_derivable_from": [
            "sni_lookup"
          ],
          "default": ""
        }
      }
    }
  }
}
```

## onboarding_questions

```json
[
  {
    "id": "q1_org_number",
    "question_sv": "Vad är bolagets organisationsnummer?",
    "fields": ["company_identity.company_registration_number"],
    "input_type": "free_text",
    "validation": "regex:^\\d{6}-?\\d{4}$",
    "logic": "always; use bolagsverket_lookup to prefill company_name, company_type, registration_date, board, auditor, fiscal year and SNI."
  },
  {
    "id": "q2_business",
    "question_sv": "Vad gör bolaget, i en mening? Du kan också skicka webbadressen.",
    "fields": ["business_activity.business_description", "company_identity.website_url", "business_activity.high_level_sector", "business_activity.sni_codes"],
    "input_type": "free_text",
    "logic": "infer SNI and sector from website and transcript; ask follow-up only if confidence is low or regulated activity is detected."
  },
  {
    "id": "q3_employees",
    "question_sv": "Hur många anställda har ni ungefär, inklusive dig själv om du tar lön?",
    "fields": ["employment_profile.employee_count", "accounting_reporting_profile.avg_employees_year_1", "tax_profile.pays_salary_to_owner", "tax_profile.is_employer_registered"],
    "input_type": "single_select",
    "inline_keyboard": ["0", "1-4", "5-9", "10-49", "50-249", "250+"],
    "logic": "if answer != 0, set employer risk gates true; if >=5 ask skyddsombud status later; if >=50 ask skyddskommitté and NIS2 size checks."
  },
  {
    "id": "q4_financial_size",
    "question_sv": "Ungefär vilken omsättning och balansomslutning hade bolaget senaste året?",
    "fields": ["accounting_reporting_profile.net_revenue_sek_year_1", "accounting_reporting_profile.balance_sheet_total_sek_year_1", "tax_profile.annual_taxable_turnover_sek", "tax_profile.vat_taxable_base_sek"],
    "input_type": "number_pair_or_range",
    "logic": "compute ÅRL size, revisionsplikt, VAT frequency and NIS2 size; if Bolagsverket annual report exists, prefill and only ask for confirmation."
  },
  {
    "id": "q5_vat_trade",
    "question_sv": "Är ni momsregistrerade, och handlar ni med kunder eller leverantörer utanför Sverige?",
    "fields": ["tax_profile.is_vat_registered", "tax_profile.vat_reporting_frequency", "tax_profile.has_eu_trade", "tax_profile.imports_from_third_countries", "tax_profile.exports_to_third_countries"],
    "input_type": "multi_select",
    "inline_keyboard": ["Momsregistrerade", "Ingen moms", "EU-handel", "Import/export utanför EU", "Vet ej"],
    "logic": "if EU-handel true, ask if B2B goods/services or B2C consumer sales; if VAT unknown, use Skatteverket lookup."
  },
  {
    "id": "q6_sensitive_domains",
    "question_sv": "Finns något av detta i verksamheten: finans, vård, utbildning, bygg, spel, alkohol/tobak/bränsle, marknadsplats/plattform, eller moln/digital infrastruktur?",
    "fields": ["business_activity.regulated_activities", "cyber_nis2_profile.nis2_sectors", "tax_profile.excise_tax_categories", "tax_profile.is_platform_operator"],
    "input_type": "multi_select",
    "inline_keyboard": ["Finans", "Vård", "Utbildning", "Bygg", "Spel/alkohol/tobak/bränsle", "Plattform", "Moln/digital infra", "Inget"],
    "logic": "branches to FI, IMY, Arbetsmiljöverket, punktskatt, DAC7 and NIS2 modules."
  },
  {
    "id": "q7_gdpr",
    "question_sv": "Behandlar ni känsliga personuppgifter, barns uppgifter, eller överför personuppgifter utanför EU/EES?",
    "fields": ["gdpr_profile.processes_personal_data", "gdpr_profile.processes_special_categories", "gdpr_profile.processes_children_data", "gdpr_profile.transfers_data_outside_eea"],
    "input_type": "multi_select",
    "inline_keyboard": ["Känsliga uppgifter", "Barns uppgifter", "Utanför EU/EES", "Bara vanlig kund/HR-data", "Vet ej"],
    "logic": "if sensitive, children, tracking or outside EEA true, ask targeted GDPR follow-up for DPO, SCC/adequacy and incident routine."
  },
  {
    "id": "q8_work_environment",
    "question_sv": "Vilken typ av arbetsmiljö har ni?",
    "fields": ["workplace_safety_profile.workplace_types", "workplace_safety_profile.risk_categories"],
    "input_type": "multi_select",
    "inline_keyboard": ["Kontor/remote", "Butik/restaurang", "Lager/transport", "Bygg", "Industri/maskiner", "Kemikalier", "Vård/labb", "Annat"],
    "logic": "if employee_count > 0, all employers get SAM; if construction/chemicals/height/biological risks are selected, ask only the corresponding risk module questions."
  },
  {
    "id": "q9_kollektivavtal_migration",
    "question_sv": "Är ni bundna av kollektivavtal eller hängavtal, och har ni eller planerar ni anställda från land utanför EU/EES?",
    "fields": ["employment_profile.has_collective_agreement", "employment_profile.collective_agreement_families", "employment_profile.has_non_eu_eea_workers", "employment_profile.hires_from_outside_eu_eea"],
    "input_type": "multi_select",
    "inline_keyboard": ["Kollektivavtal", "Hängavtal", "Inget avtal", "Anställda utanför EU/EES", "Planerar rekrytera", "Vet ej"],
    "logic": "if non-EU hiring true, evaluate work permit thresholds; if collective agreement true, use it for salary-floor matching."
  },
  {
    "id": "q10_group_accounting",
    "question_sv": "Ingår bolaget i en koncern, har utländsk filial, kryptotillgångar eller incitamentsprogram med aktier?",
    "fields": ["accounting_reporting_profile.is_part_of_group", "accounting_reporting_profile.is_parent_company", "accounting_reporting_profile.has_foreign_filial", "accounting_reporting_profile.has_crypto_assets", "accounting_reporting_profile.has_share_based_payments"],
    "input_type": "multi_select",
    "inline_keyboard": ["Koncern", "Moderbolag", "Utländsk filial", "Krypto", "Aktieincitament", "Inget"],
    "logic": "ask only if size thresholds, SNI or Bolagsverket lookup indicate accounting complexity; otherwise defer."
  }
]
```

## inference_rules

The engine should infer before asking. SNI is a classification standard used to classify companies and workplaces by activity, and SCB states that Skatteverket collects SNI codes when companies register their activities ([SCB SNI](https://www.scb.se/dokumentation/klassifikationer-och-standarder/standard-for-svensk-naringsgrensindelning-sni/)).

```python
def compute_revisionsplikt(profile):
    # Source: Bolagsverket threshold 3 employees, 1.5 MSEK balance, 3 MSEK net revenue.
    y1 = hits(profile.avg_employees_year_1 > 3,
              profile.balance_sheet_total_sek_year_1 > 1_500_000,
              profile.net_revenue_sek_year_1 > 3_000_000)
    y2 = hits(profile.avg_employees_year_2 > 3,
              profile.balance_sheet_total_sek_year_2 > 1_500_000,
              profile.net_revenue_sek_year_2 > 3_000_000)
    return (y1 > 1 and y2 > 1) or profile.company_type == "publikt_ab"

def compute_arl_size(profile):
    if profile.is_publicly_listed:
        return "storre_foretag"
    y1 = hits(profile.avg_employees_year_1 > 50,
              profile.balance_sheet_total_sek_year_1 > 40_000_000,
              profile.net_revenue_sek_year_1 > 80_000_000)
    y2 = hits(profile.avg_employees_year_2 > 50,
              profile.balance_sheet_total_sek_year_2 > 40_000_000,
              profile.net_revenue_sek_year_2 > 80_000_000)
    return "storre_foretag" if y1 > 1 and y2 > 1 else "mindre_foretag"

def compute_vat_frequency(profile):
    if not profile.is_vat_registered:
        return "none"
    if profile.vat_taxable_base_sek > 40_000_000:
        return "monthly_only"
    if profile.vat_taxable_base_sek > 1_000_000:
        return "quarterly_or_monthly"
    return "annual_quarterly_or_monthly"

def compute_k_framework(profile):
    if profile.is_credit_institution_or_securities_firm:
        return "arkl"
    if profile.is_insurance_company:
        return "arfl"
    if profile.is_publicly_listed and profile.is_parent_company:
        return "k4_ifrs_consolidated"
    if profile.computed_arl_size_class == "storre_foretag":
        return "k3_mandatory"
    if profile.company_type == "publikt_ab" or profile.has_foreign_filial or profile.has_crypto_assets or profile.has_share_based_payments or profile.has_convertible_or_equity_settled_debt:
        return "k3_mandatory_from_2026"
    if profile.building_revenue_share_pct >= 75 and not within_k2_relief_rule(profile):
        return "k3_mandatory_from_2026"
    return "k2_eligible_or_k3_optional"

def compute_nis2(profile):
    medium = profile.employee_count >= 50 or profile.annual_turnover_eur > 10_000_000 or profile.balance_sheet_total_eur > 10_000_000
    always = profile.is_digital_infrastructure_provider
    sector_hit = bool(set(profile.nis2_sectors) - {"none_unknown"})
    return always or (medium and sector_hit)
```

BFN states that many smaller ABs may choose K2, while larger companies or companies that cannot apply K2 use K3; BFN's 2025 K2/K3 changes also force K3 for companies with foreign branches, crypto assets beyond occasional payment use, share-based payments, equity-settled debt-like instruments, and certain building/deferred-tax cases from financial years beginning after 31 December 2025 ([BFN K2/K3 changes](https://www.bfn.se/fragor-och-svar/andringar-i-k2-och-k3-fran-2026/)). Cybersäkerhetslagen scope is derived from sector plus the EU medium-company threshold, with medium meaning at least 50 employees or more than 10 MEUR turnover or balance-sheet total, and some digital infrastructure cases are in scope regardless of size ([MSB guide PDF](https://rib.msb.se/filer/pdf/31243.pdf)).

## matching_examples

### Example: Skatteverket VAT reporting-frequency change

- Event: Skatteverket updates VAT reporting deadlines for monthly filers.
- Matching profile: `is_vat_registered=true`, `vat_taxable_base_sek=55_000_000`, `vat_reporting_frequency=monthly`.
- No-match profile: `is_vat_registered=true`, `vat_taxable_base_sek=700_000`, `vat_reporting_frequency=annual`.
- Decision attributes: `tax_profile.is_vat_registered`, `tax_profile.vat_taxable_base_sek`, `tax_profile.vat_reporting_frequency`.
- Rule: show only when `is_vat_registered and vat_reporting_frequency == "monthly"`.

### Example: Bolagsverket revisionsplikt threshold

- Event: Bolagsverket sends reminders to ABs that meet the auditor threshold.
- Matching profile: `avg_employees_year_1=4`, `avg_employees_year_2=4`, `net_revenue_sek_year_1=4_200_000`, `net_revenue_sek_year_2=3_900_000`.
- No-match profile: `avg_employees_year_1=1`, `avg_employees_year_2=1`, `net_revenue_sek_year_1=1_200_000`, `balance_sheet_total_sek_year_1=900_000`.
- Decision attributes: two-year employees, net revenue and balance-sheet total.
- Rule: show only when more than one lower audit threshold is exceeded in both years.

### Example: IMY third-country transfer enforcement

- Event: IMY publishes enforcement about tracking pixels transferring sensitive pharmacy data to Meta.
- Matching profile: `processes_special_categories=true`, `uses_behavioral_tracking=true`, `transfers_data_outside_eea=true`.
- No-match profile: `processes_customer_data=true`, `uses_behavioral_tracking=false`, `transfers_data_outside_eea=false`.
- Decision attributes: `gdpr_profile.processes_special_categories`, `uses_behavioral_tracking`, `transfers_data_outside_eea`.
- Rule: hard gate is GDPR processing; special categories plus tracking plus outside-EEA transfer raises score to critical relevance.

### Example: Arbetsmiljöverket construction fall-risk rule

- Event: Arbetsmiljöverket updates guidance on fall-risk controls in construction.
- Matching profile: `is_construction_project_actor=true`, `workplace_involves_work_at_height=true`, `max_height_difference_metres=2.5`.
- No-match profile: `workplace_types=["office"]`, `workplace_involves_work_at_height=false`.
- Decision attributes: `workplace_safety_profile.is_construction_project_actor`, `max_height_difference_metres`, `has_arbetsmiljoplan`.
- Rule: show when construction actor and height difference is at least two metres.

### Example: Cybersäkerhetslagen/NIS2 registration

- Event: Regeringen issues Cybersäkerhetslagen and PTS publishes in-scope assessment support.
- Matching profile: `nis2_sectors=["digital_infrastructure"]`, `is_digital_infrastructure_provider=true`, `employee_count=8`.
- No-match profile: `nis2_sectors=["none_unknown"]`, `employee_count=8`, `annual_turnover_eur=700_000`.
- Decision attributes: `cyber_nis2_profile.nis2_sectors`, `is_digital_infrastructure_provider`, `employee_count`, `annual_turnover_eur`.
- Rule: digital infrastructure is hard-gated in even below the normal medium-company threshold; ordinary micro companies outside listed sectors are not matched.

## matching_algorithm

```python
def match_event(event, profile):
    if is_anti_pattern(event):
        return no_notification("anti_pattern")
    hard = eval_hard_gates(event.category, profile)
    if not hard.passed:
        return no_notification("hard_gate_failed")
    score = base_score(event.category)
    score += soft_signal_score(event, profile)
    score += deadline_boost(event, profile)
    score += sanction_boost(event, profile)
    return notification(score=min(100, max(0, score)), severity=severity(event, profile))
```

| Regulatory category | Deterministic predicate | Hard gates | Soft signals |
|---|---|---|---|
| `VAT_registration` | `activity_vat_status in ["taxable","mixed"] AND annual_taxable_turnover_sek > 120000 OR eu_goods_purchases_sek > 90000 OR buys_b2b_services_from_abroad OR sells_services_to_eu_businesses` | VAT-taxable activity or cross-border VAT trigger | near 120k threshold, EU trade |
| `VAT_reporting_frequency` | `is_vat_registered == true AND vat_reporting_frequency in event.vat_periods` | VAT registered and period match | deadline proximity |
| `AGI_changes` | `is_employer_registered == true OR employee_count > 0 OR pays_salary_to_owner == true` | employer registration/payroll | VAB/sick-leave process missing |
| `Excise_tax` | `excise_tax_categories intersects event.excise_categories` | exact punktskatt category | SNI in high-risk category |
| `DAC7` | `is_platform_operator AND platform_nexus_sweden AND NOT has_dac7_exemption` | platform operator and Swedish nexus | platform activity count |
| `Annual_report` | `company_form in ["ab","publikt_ab"] AND lifecycle_status != "under_formation"` | AB registered | fiscal-year deadline proximity |
| `Revisionsplikt` | `requires_auditor == true` | computed audit duty | near threshold |
| `K2_K3` | `accounting_framework in event.frameworks OR compute_k_framework(profile) in event.frameworks` | K-framework match | foreign branch, crypto, share-based payments, building revenue |
| `GDPR_general` | `processes_personal_data == true` | personal data processing | customer data, tracking, AI profiling |
| `GDPR_art9_children_transfers` | `processes_special_categories OR processes_children_data OR transfers_data_outside_eea` | exact GDPR risk flag | behaviour tracking, cloud vendors |
| `DPO` | `core_activity_large_scale_monitoring OR core_activity_large_scale_special_category_data` | core-activity DPO trigger | group DPO presence |
| `Sjuklon_VAB` | `employee_count > 0 OR is_employer_registered` | employer | parent employees, sick-pay process missing |
| `SAM` | `employee_count > 0` | employer | employee_count >= 5 or >= 50 |
| `Construction_safety` | `is_construction_project_actor OR primary_sni_section == "F"` | construction actor | height >=2m, missing BAS/plan |
| `Chemical_risk` | `uses_chemicals_at_work OR uses_cmr_substances` | chemical exposure | manufacturing, cleaning, healthcare |
| `Biological_risk` | `handles_biological_agents OR "healthcare" in workplace_types` | biological/healthcare risk | class >=3 |
| `Work_permit` | `has_non_eu_eea_workers OR hires_from_outside_eu_eea` | non-EU hiring | collective agreement unknown, salary below threshold |
| `Kollektivavtal` | `has_collective_agreement OR has_hangavtal OR employer_organisation_member` | binding agreement | SNI likely agreement family |
| `NIS2` | `nis2_in_scope == true OR compute_nis2(profile) == true` | sector plus size or always-in-scope | group size, digital infra |

Hard gates exclude a notification. Soft signals only adjust relevance. The score starts at 60 for an exact hard-gate match, adds 10-25 for deadline, sanction and missing-process signals, subtracts 10-30 for weak or stale profile evidence, and displays only when score is at least 50. Scores 50-64 are low relevance, 65-79 medium relevance, 80-89 high relevance and 90-100 must-not-miss.

LLM judgment is allowed only outside core gating. LLMs may classify a free-text event summary into candidate categories, extract likely deadlines from prose for human review, and suggest SNI or regulated-activity candidates from a website. LLMs must not decide whether an AB is revisionspliktigt, NIS2-in-scope, VAT monthly, DPO-required, DAC7-reporting, or subject to work-permit salary thresholds; those decisions are deterministic from stored profile fields and event metadata.

## severity_model

| Level | Criteria | Delivery behavior |
|---|---|---|
| `critical` | Active legal deadline within 7 days, direct ban/risk of unlawful operation, material sanction risk, incident-reporting clock, work-permit rule that can block hiring, forced filing with liquidation/sanction escalation. | Push immediately and repeat until acknowledged. |
| `high` | New binding law, threshold change or authority position with financial, payroll, audit, accounting or sector-compliance impact within 30 days. | Push same day. |
| `medium` | Periodic filing, guidance that changes interpretation, enforcement trend affecting profile, or compliance preparation window over 30 days. | Batch daily or weekly depending on deadline. |
| `low` | Registry hygiene, explanatory guidance, professional newsletter interpretation or duplicate secondary coverage of an already-matched official event. | Include in digest only. |

| Source | Event-type mapping |
|---|---|
| Skatteverket | Lagändring and filing-deadline change: high or critical if deadline <7 days; rättsfall/ställningstagande: medium unless it changes VAT/tax treatment for matched sector; generic tax-account interest: medium. |
| Bolagsverket | Filing deadline, revisor, liquidation, UBO and annual-report requirements: high or critical by deadline; ordinary register news: low. |
| IMY | Sanktionsavgift or security incident precedent: high/critical when same data-risk profile; general guidance: medium; annual statistics: low/medium. |
| BFN | K2/K3/K4 changes and effective dates: high for matched framework, medium otherwise; general consultation: low unless imminent. |
| Försäkringskassan | Employer reporting or sick-pay/VAB process changes: high for employers, medium otherwise. |
| Arbetsmiljöverket | New AFS or risk-specific binding requirement: high/critical for matched workplace risk; inspection campaign: medium; generic advice: low. |
| Migrationsverket | Work-permit salary, insurance, employer eligibility and application rules: critical for active non-EU hiring, high for planned hiring. |
| Riksdagen/Regeringen | Enacted law: severity follows affected category; proposition/remiss: medium until enacted unless deadline is fixed. |
| Verksamt | Cross-authority operational guidance: low/medium, never outranks the underlying authority. |
| FAR/Srf | Professional interpretation: medium if it clarifies a matched official change, low if duplicate newsletter coverage. |

Severity escalation is deterministic. Escalate one level if `days_to_deadline <= 7`, if `estimated_direct_cost_or_sanction_sek >= 100000`, if `sanction_risk == true`, if `incident_reporting_clock_hours <= 72`, if `profile.requires_auditor == true AND auditor_appointed == false`, or if `profile.nis2_in_scope == true AND event.category == "NIS2_incident_reporting"`. Do not escalate because text sounds alarming.

## validation_corpus

| ID | Source | Date | Event | Categories | Severity | Sample profile match |
|---|---|---|---|---|---|---|
| SKV-2025-001 | Skatteverket | 2025-01-01 | [Ny omsättningsgräns för momsbefrielse: 120 000 kr från 1 januari 2025](https://www.skatteverket.se/foretag/moms/momsbefrielseforforetagmedlagomfattning.4.html) | VAT / moms, SME administrative relief, EU cross-border VAT | high | VAT monthly filer, cross-border trader, employer AB (small) |
| SKV-2025-002 | Skatteverket | 2025-01-01 | [Frånvarorapportering i AGI obligatorisk från januari 2025](https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration.4.41f1c61d16193087d7fcaeb.html) | Employer reporting, Social insurance, Payroll compliance | high | employer AB, construction employer |
| SKV-2024-003 | Skatteverket | 2024-12-01 | [Ränta på skattekontot sänks: basränta 2,5 % från 1 december 2024](https://www.skatteverket.se/privat/skatter/skattekontobetalaochfatillbaka/rantapaskattekontot.4.18e1b10334ebe8bc80002582.html) | Tax account / skattekonto, Interest rates, Cash flow planning | medium | employer AB, VAT monthly filer |
| SKV-2025-004 | Skatteverket / Riksdagen | 2025-11-27 | [Nya 3:12-regler för fåmansföretagare gäller från 1 januari 2026](https://www.srfkonsult.se/branschfragor/famansforetag--312-reglerna) | Corporate tax, Closely held companies (fåmansbolag), Owner remuneration | high | employer AB |
| SKV-2025-005 | Skatteverket | 2025-10-09 | [Skatteverket ändrar syn på moms vid verksamhetsöverlåtelser efter HFD 2025 ref. 32](https://news-se.forvismazars.com/2025/10/09/skatteverket-andrar-syn-pa-moms-vid-verksamhetsoverlatelser/) | VAT / moms, Business transfers, Court decision / praxis | high | VAT monthly filer, employer AB |
| BV-2025-001 | Bolagsverket / Riksdagen | 2025-01-01 | [Bostadsrättsföreningar och ekonomiska föreningar måste lämna in årsredovisning till Bolagsverket från 2025](https://www.fastighetsagarna.se/aktuellt/nyheter/2024/sverige/brfs-arsredovisning-for-2025-och-framat-ska-skickas-till-bolagsverket/) | Annual report filing, Corporate compliance, Anti-fraud / AML | high | employer AB |
| BV-2025-002 | Bolagsverket / BFN / Riksdagen | 2024-07-01 | [Årsredovisningslagen ändrad: årsredovisning ska dateras fr.o.m. räkenskapsår som inleds efter 30 juni 2024](https://www.far.se/kunskap/redovisning/datering-av-arsredovisning-vad-galler/) | Annual report, Corporate governance, Accounting law (ÅRL) | medium | employer AB, VAT monthly filer |
| BV-2026-003 | Bolagsverket / Riksdagen / Regeringen | 2026-02-12 | [Proposition 2025/26:129 – Utlämnande av uppgifter ur registret över verkliga huvudmän](https://www.regeringen.se/contentassets/4f9ff61d261c413e89e710b8b4a03b7c/utlamnande-av-uppgifter-ur-registret-over-verkliga-huvudman-prop.-202526129.pdf) | Beneficial ownership, AML / KYC, Corporate registry | medium | employer AB, cross-border trader |
| BFN-2024-001 | BFN (Bokföringsnämnden) | 2024-06-13 | [BFNAR 2024:1 – Ändringar i bokföringsreglerna (BFNAR 2013:2)](https://www.bfn.se/redovisningsregler/allmanna-rad/) | Bookkeeping / accounting, Record keeping, BFN normgivning | medium | employer AB, VAT monthly filer |
| BFN-2024-002 | BFN (Bokföringsnämnden) | 2024-12-13 | [BFNAR 2024:4 – Ändringar i K2-regelverket (årsredovisning i mindre företag) fr.o.m. räkenskapsår som inleds efter 30 juni 2024](https://www.bfn.se/wp-content/uploads/bfnar2024-4.pdf) | Annual report (K2), SME accounting, BFN normgivning | medium | employer AB, VAT monthly filer |
| BFN-2025-003 | BFN (Bokföringsnämnden) / Srf konsulterna | 2025-06-01 | [BFN beslutar om ändringar i K2 och K3 som tillämpas för räkenskapsår fr.o.m. 1 januari 2026](https://www.srfkonsult.se/branschfragor/forandringar-i-k-regelverken) | Annual report (K2/K3), SME accounting, BFN normgivning | high | employer AB, VAT monthly filer |
| FK-2025-001 | Försäkringskassan / Skatteverket | 2025-01-01 | [Arbetsgivare ska rapportera frånvarouppgifter i AGI från januari 2025](https://www.forsakringskassan.se/privatperson/sjuk-eller-skadad/ersattning-nar-du-ar-sjuk-eller-skadad-sjukpenning/nytt-satt-att-forlanga-din-sjukpenning) | Employer reporting, Social insurance, Parental leave | high | employer AB, construction employer |
| FK-2025-002 | Försäkringskassan | 2025-09-29 | [Nytt sätt att ansöka om förlängd sjukpenning från 29 september 2025](https://www.forsakringskassan.se/privatperson/sjuk-eller-skadad/ersattning-nar-du-ar-sjuk-eller-skadad-sjukpenning/nytt-satt-att-forlanga-din-sjukpenning) | Sick pay / sjukpenning, Social insurance, Employer-employee interaction | medium | employer AB, construction employer |
| FK-2026-003 | Försäkringskassan | 2026-01-02 | [Nya lagar 2026: Höjd pensionsålder till 67 år, utökade VAB-möjligheter, sänkt funkisskatt](https://www.forsakringskassan.se/nyhetsarkiv/nyheterpress/nyalagarochregler2026sompaverkarsocialforsakringen.5.4b51e19c19ac9dd9b2f196.html) | Pension age, Parental leave (VAB), Social insurance | medium | employer AB, construction employer |
| AV-2025-001 | Arbetsmiljöverket | 2025-01-27 | [Ny regelstruktur med 15 föreskrifter träder i kraft 1 januari 2025](https://www.av.se/press/nu-har-arbetsmiljoverkets-nya-regelstruktur-tratt-i-kraft/) | Work environment / arbetsmiljö, Construction safety, Employer obligations | high | employer AB, construction employer |
| AV-2025-002 | Arbetsmiljöverket | 2025-01-01 | [AFS 2023:3 – Projektering och byggmiljösamordning: nya regler för byggherrar och Bas-P/Bas-U från 1 januari 2025](https://www.byggfakta.se/blogg/ny-foreskrift.ska-lyfta-arbetsmiljon-galler-fran-1-januari-2025) | Construction safety, Work environment, Building project management | critical | construction employer |
| MV-2026-001 | Migrationsverket / Riksdagen | 2026-03-18 | [Nya regler för arbetstillstånd från 1 juni 2026: lönekrav 90 % av medianlön, sjukförsäkringskrav, nya brott](https://www.migrationsverket.se/du-har-tillstand-i-sverige/arbeta.html) | Labour immigration, Work permits, Employer sanctions | critical | employer AB, construction employer, cross-border trader |
| RD-2024-001 | Riksdagen / Regeringen | 2024-05-01 | [Riksdagen antar ny lag om hållbarhetsrapportering (CSRD) – gäller fr.o.m. räkenskapsår som inleds 1 juli 2024](https://www.fi.se/sv/hallbarhet/regler/hallbarhetrapportering/) | Sustainability reporting (CSRD/ESRS), Annual report, Audit | critical | employer AB |
| RD-2025-002 | Riksdagen / Regeringen | 2025-09-30 | [CSRD stop-the-clock: Riksdagen skjuter upp hållbarhetsrapportering för Våg 2 och 3-företag](https://www.regeringen.se/pressmeddelanden/2025/09/krav-pa-hallbarhetsrapportering-skjuts-upp-for-vissa-foretag/) | Sustainability reporting (CSRD), Annual report, Regulatory relief | high | employer AB |
| RD-2025-003 | Riksdagen / Regeringen | 2025-12-11 | [Cybersäkerhetslagen (2025:1506) beslutas av riksdagen – NIS2 genomförs i Sverige från 15 januari 2026](https://www.regeringen.se/pressmeddelanden/2025/12/regeringen-utfardar-en-ny-cybersakerhetslag/) | Cybersecurity (NIS2/CSL), Incident reporting, Critical infrastructure | critical | NIS2 digital provider, employer AB |
| IMY-2024-001 | IMY | 2024-08-30 | [IMY beslutar om sanktionsavgifter 37 MSEK mot Apoteket AB och 8 MSEK mot Apohem – Meta-pixel överföring](https://www.imy.se/nyheter/sanktionsavgifter-mot-apoteket-och-apohem-for-overforing-av-personuppgifter-till-meta/) | GDPR art. 32, Data breach, Third-party tracking / cookies, Sensitive personal data (art. 9) | critical | GDPR special-category processor |
| IMY-2025-004 | IMY | 2025-06-18 | [IMY dömer SL och WÅAB till 75 000 kr vardera – GDPR-brott vid nykterhetskontroller](https://www.imy.se/nyheter/) | GDPR, Employee monitoring, Sensitive personal data, Workplace data | medium | employer AB, GDPR special-category processor |
| IMY-2026-005 | IMY | 2026-01-26 | [Sportadmin döms till 6 MSEK i sanktionsavgift efter IT-attack – 2,1 miljoner personers data exponerade](https://www.imy.se/nyheter/sanktionsavgift-mot-sportadmin-for-bristande-it-sakerhet/) | GDPR art. 32, IT security, Data breach, Children's data | critical | NIS2 digital provider, GDPR special-category processor |
| IMY-2025-006 | IMY | 2026-01-01 | [IMY prioriterar AI, barn och brottsbekämpning i tillsynsplan 2026](https://www.imy.se/nyheter/) | GDPR, AI regulation, Children's data, Supervisory priorities | medium | GDPR special-category processor, NIS2 digital provider |
| FAR-2024-001 | FAR | 2024-06-26 | [FAR antar RevR 19 – rekommendation för granskning av lagstadgade hållbarhetsrapporter (CSRD/ESRS)](https://www.far.se/aktuellt/nyheter/2024/juni/ny-rekommendation-for-granskning-av-hallbarhetsrapporter/) | CSRD sustainability audit, Auditor standards (RevR 19), Annual report | high | employer AB |
| FAR-2025-002 | FAR | 2025-01-28 | [FAR publicerar vägledning om viktiga branscharenor 2025: CSRD, AI, auktorisering av redovisningskonsulter](https://www.far.se/aktuellt/nyheter/2025/januari/viktiga-fragor-for-branschen-under-2025/) | Accounting profession, Audit standards, CSRD, AI in accounting | medium | employer AB, VAT monthly filer |
| SRF-2026-001 | Srf konsulterna | 2026-02-25 | [Srf Redovisning 2026: BFN:s ändringar i K2 och K3 gäller räkenskapsår fr.o.m. 1 januari 2026](https://www.srfkonsult.se/nyheter-paverkan/aktuellt/srf-redovisning-2026-ar-har--uppdaterad-och-tillganglig-i-tre-format) | Annual report (K2/K3), Accounting standards, SME accounting | medium | employer AB, VAT monthly filer |
| VERK-2025-001 | Verksamt (Tillväxtverket / Skatteverket / Bolagsverket) | 2026-03-06 | [Verksamt.se uppdaterar information om momsredovisning – ny omsättningsgräns 120 000 kr](https://verksamt.se/skatter-avgifter/redovisa-betala-moms) | VAT / moms, Small business, Administrative simplification | low | VAT monthly filer, employer AB (small) |
| RD-2025-004 | Riksdagen / Riksdagsproposition | 2025-12-17 | [Budgetpropositionen 2026 (prop. 2025/26:1): Bolagsverket får utökade resurser mot brottsliga bolag](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/betankande/utgiftsomrade-24-naringsliv_hd01nu1/html/) | Corporate compliance, Anti-fraud, Bolagsverket registry | medium | employer AB |
| IMY-2026-007 | IMY | 2026-02-26 | [IMY: 89 % ökning av dataintrångsanmälningar under 2025 – 12 276 anmälningar totalt](https://www.grip.globalrelay.com/swedish-imy-reports-89-increase-in-data-breaches-during-2025/) | GDPR art. 33 (breach notification), Cybersecurity, Data breach statistics | medium | GDPR special-category processor, NIS2 digital provider, employer AB |
| MV-2025-001 | Migrationsverket | 2025-12-04 | [Migrationsverket: afghanska myndigheter kan utfärda hemlandspass – individuell prövning av främlingspass](https://www.migrationsverket.se/du-har-tillstand-i-sverige/arbeta.html) | Immigration / migration, Travel documents, Work permits | low | employer AB, cross-border trader |
| RD-2025-005 | Riksdagen / FAR | 2025-12-31 | [CSRD Omnibus I (EU 2025/794): 'Stop the clock' – hållbarhetsrapportering senareläggs för Våg 2 och 3](https://www.far.se/kunskap/hallbarhet/fragor-och-svar-om-csrd/) | CSRD / sustainability reporting, Annual report, EU directive implementation | high | employer AB |
| AV-2024-003 | Arbetsmiljöverket | 2024-09-30 | [Fyra ändringsföreskrifter på arbetsmiljöområdet beslutade under 2024 – ikraftträdande 1 januari 2025](https://www.av.se/press/nu-har-arbetsmiljoverkets-nya-regelstruktur-tratt-i-kraft/) | Work environment, Chemical risks, Ergonomics, Employer obligations | medium | construction employer, employer AB |
| BFN-2025-004 | BFN (Bokföringsnämnden) | 2025-03-24 | [BFNAR 2025:1 – Ändringar i förenklat årsbokslut för enskilda näringsidkare (BFNAR 2006:1) fr.o.m. räkenskapsår 2025](https://www.bfn.se/wp-content/uploads/bfnar2025-1.pdf) | Annual accounts (enskild firma), BFN normgivning, Sole traders | low | VAT monthly filer, employer AB (small) |
| FK-2025-003 | Försäkringskassan | 2026-03-01 | [Ny regel: Anställda med hel sjukpenning kan arbetspröva utan att ersättningen dras in (fr.o.m. 1 mars 2026)](https://www.forsakringskassan.se/nyhetsarkiv/nyheterpress/nyalagarochregler2026sompaverkarsocialforsakringen.5.4b51e19c19ac9dd9b2f196.html) | Sick pay / rehabilitation, Employer-employee interaction, Social insurance | medium | employer AB, construction employer |
| IMY-2025-007 | IMY | 2025-01-01 | [Nationella riktlinjer för generativ AI i offentlig förvaltning publicerade av Digg och IMY](https://www.imy.se/nyheter/) | AI regulation, GDPR, Public sector compliance | medium | GDPR special-category processor, NIS2 digital provider |
| RD-2026-001 | Riksdagen | 2026-03-18 | [Riksdagen beslutar om Prop. 2025/26:87 – Nya regler för arbetskraftsinvandring (beslutsdatum 18 mars 2026)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/betankande/nya-regler-for-arbetskraftsinvandring_hd01sfu12/html/) | Labour immigration, Work permits, Employer sanctions, Criminal law | critical | employer AB, construction employer, cross-border trader |

## anti_patterns

| Anti-pattern | Detection rule | Action |
|---|---|---|
| Press release without regulatory content | `event.content_type == "press_release" AND no deadline AND no legal_basis AND no obligation_change` | Suppress. |
| Internal myndighets-administrativt beslut | `event.audience == "authority_internal" AND not addressed_to_companies` | Suppress. |
| Historical analysis without forward-looking impact | `event.is_retrospective == true AND no future deadline AND no changed interpretation` | Suppress or digest-only. |
| Duplicate secondary announcement | `canonical_event_hash already exists AND source_priority < official_source_priority` | Attach as secondary source to original notification. |
| Generic “året som gått” summary | title/body contains annual-summary patterns and no new rule effective date | Suppress. |
| Newsletter commentary with no independent rule | FAR/Srf article where cited official event already notified and no new deadline/interpretation | Deduplicate into source note. |
| Consultation/remiss without current obligation | `event.stage in ["remiss","utredning"] AND no enacted_date` | Digest-only unless user opted into early warnings. |
| Keyword-only sector false positive | Keyword match but no SNI, regulated activity, registration or threshold match | Suppress. |
| Consumer-only guidance | `audience == "private_person"` and no employer/company obligation | Suppress for AB owners unless payroll relevance exists. |
| Local municipal rule outside profile geography | Municipal/regional event and `profile.registered_county` or workplace municipality does not match | Suppress. |

## open_questions

- Intrastat thresholds are intentionally not hard-coded in v1. SCB thresholds change and should be ingested from the current SCB Intrastat source before launch.
- Environmental permitting is represented only as a profile hook. A full Miljöbalken A/B/C/U taxonomy needs its own schema module if environmental notifications become a core category.
- Kollektivavtal family inference from SNI is probabilistic. The deterministic gate is whether the company is actually bound by an agreement, not which agreement appears likely.
- NIS2 Swedish implementation details should be versioned as the supervisory rollout matures in 2026. The current schema supports deterministic scope, but sector-authority edge cases need authority-maintained lookup tables.
- Work-permit salary thresholds depend on decision date and transition rules. The matching engine must store event effective date and application/extension status, not only current salary.
- Public validation event URLs from some authority archives were unstable. The corpus includes official alternatives where primary news archives were unavailable, and those rows should be re-verified before classifier benchmarking.

## sources

1. [Skatteverket: När ska jag deklarera moms?](https://www.skatteverket.se/foretag/moms/deklareramoms/narskajagdeklareramoms.4.6d02084411db6e252fe80008988.html)
2. [Skatteverket: Registrera ditt företag för moms](https://skatteverket.se/foretag/moms/momsregistrering/registreradittforetagformoms.4.deeebd105a602bfe38000256.html)
3. [Skatteverket: Kontrolluppgifter från plattformsoperatörer](https://www.skatteverket.se/foretag/skatterochavdrag/kontrolluppgifter/kontrolluppgifterfranplattformsoperatorerku90ku91ku92ochku93.4.21e4ba96188260715e3109.html)
4. [Skatteverket: Skatt på bränsle](https://www.skatteverket.se/foretag/skatterochavdrag/punktskatter/energiskatter/skattpabransle.4.15532c7b1442f256bae5e56.html)
5. [Årsredovisningslagen](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arsredovisningslag-19951554_sfs-1995-1554/)
6. [Bolagsverket: Revisor i aktiebolag](https://bolagsverket.se/foretag/aktiebolag/startaaktiebolag/revisoriaktiebolag.521.html)
7. [Bolagsverket: Ändra räkenskapsår](https://bolagsverket.se/foretag/aktiebolag/drivaaktiebolag/andrarakenskapsarforaktiebolag.581.html)
8. [Bolagsverket: Krav på bosättning](https://bolagsverket.se/foretag/aktiebolag/startaaktiebolag/styrelseochverkstallandedirektoriaktiebolag/kravpabosattningforstyrelseniettaktiebolag.509.html)
9. [BFN: Ändringar i K2 och K3 från 2026](https://www.bfn.se/fragor-och-svar/andringar-i-k2-och-k3-fran-2026/)
10. [BFN: Aktiebolag redovisningsregler](https://www.bfn.se/redovisningsregler/vad-galler-for/aktiebolag/)
11. [IMY: Dataskyddsombud](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/dataskyddsombud/)
12. [IMY: Känsliga personuppgifter](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/kansliga-personuppgifter/)
13. [IMY: Personuppgifter om barn](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/personuppgifter-om-barn/)
14. [IMY: Överföring till tredjeland](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/overforing-till-tredje-land/)
15. [Försäkringskassan: Sjuklön](https://www.forsakringskassan.se/arbetsgivare/sjukdom-och-skada/sjuklon)
16. [Försäkringskassan: VAB](https://www.forsakringskassan.se/privatperson/foralder/vard-av-barn-vab)
17. [Arbetsmiljöverket: Systematiskt arbetsmiljöarbete](https://www.av.se/arbetsmiljoarbete-och-inspektioner/arbeta-med-arbetsmiljon/systematiskt-arbetsmiljoarbete/)
18. [Arbetsmiljöverket: AFS 2023:10](https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202310/)
19. [Arbetsmiljöverket: Bygg](https://www.av.se/produktion-industri-och-logistik/bygg/)
20. [Migrationsverket: Arbetsgivare så fungerar det](https://www.migrationsverket.se/arbetsgivare/sa-fungerar-det.html)
21. [Migrationsverket: Anställa från länder utanför EU/EES](https://www.migrationsverket.se/arbetsgivare/du-vill-anstalla/anstalla-fran-lander-utanfor-eu-ees.html)
22. [Verksamt: Kollektivavtal för arbetsgivare](https://verksamt.se/personal-rekrytering/kollektivavtal-arbetsmiljo/kollektivavtal-for-dig-som-arbetsgivare)
23. [SCB: SNI](https://www.scb.se/dokumentation/klassifikationer-och-standarder/standard-for-svensk-naringsgrensindelning-sni/)
24. [PTS: Cybersäkerhetslagen support](https://pts.se/nyheter-och-pressmeddelanden/pts-e-tjanst-stottar-foretag-infor-ny-cybersakerhetslag/)
25. [MSB guide: Utövare som omfattas av cybersäkerhetslagen](https://rib.msb.se/filer/pdf/31243.pdf)
26. [Riksdagen: Ett starkt skydd för nätverks- och informationssystem](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/betankande/ett-starkt-skydd-for-natverks-och_hd01f%C3%B6u2/html/)

## self_critique

1. Weak assumption: SNI can be inferred accurately from a website plus one business-description answer. This holds only when the company’s website describes revenue-generating activity clearly. If not, onboarding needs a guided “what do you sell and to whom?” flow and a manual SNI confirmation step.
2. Weak assumption: “Kollektivavtal family” can be guessed from SNI. This holds only as a soft signal. The deterministic design must rely on actual employer-organisation membership or hängavtal status; otherwise the product should avoid agreement-specific alerts and show only general employer alerts.
3. Weak assumption: NIS2 scope can be reduced to sector plus size for most SMBs. This holds for ordinary private ABs outside special always-in-scope digital infrastructure. If supervisory guidance expands exceptional criteria, the engine needs an authority-maintained NIS2 sector lookup and a “special significance” override field.
4. Weak assumption: user-reported financial size is good enough during onboarding. This holds only for rough early matching. For production, Bolagsverket annual-report extraction should overwrite user estimates for ÅRL, revisionsplikt and NIS2 size.
5. Weak assumption: GDPR high-risk processing can be captured with booleans. This holds for hard gates like special categories, children’s data, third-country transfers and large-scale monitoring. DPIA necessity often depends on combinations and context, so the product should treat DPIA alerts as “review required” unless a deterministic IMY checklist rule is satisfied.
