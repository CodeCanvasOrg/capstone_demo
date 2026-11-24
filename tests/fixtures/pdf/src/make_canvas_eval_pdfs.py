"""
Builds the synthetic source sets of tests/eval/canvas_density.json: three short reports with
headings, figures and a table, so a canvas can be generated from them and its text checked
against what they say. All content is invented for evaluation; nothing here is a real project.

    python/pdf_worker/.venv/bin/python tests/fixtures/pdf/src/make_canvas_eval_pdfs.py
"""
import pymupdf
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent

DOCS = {
    "canvas_heat.pdf": [
        ("Cooling the Harbour District: results of a three-summer heat mitigation pilot", None),
        ("Background", [
            "The Harbour District covers 4.2 square kilometres of dense, low-rise housing and light industry. Before the pilot, its summer night-time air temperature ran on average 3.1 degrees Celsius above the nearest rural weather station. City health records showed 214 heat-related emergency visits across the two summers before the pilot, concentrated among residents over 65.",
            "The district has little tree canopy. In 2021 an aerial survey measured canopy cover at 7 percent of the district area, against a city average of 19 percent. Roofs are mostly dark bitumen or concrete tile, and about 38 percent of the district surface is paved. These materials absorb sunlight during the day and release the stored heat after sunset, which is why the temperature difference is largest at night.",
        ]),
        ("Approach", [
            "The pilot combined three measures over three summers, 2022 to 2024. The first was reflective roof coating on 112 roofs, chosen because they had enough sun exposure and a roof structure that could carry the work without repair. The coating raised the solar reflectance of a typical roof from 0.08 to 0.62 when new.",
            "The second measure was street tree planting. The city planted 1,450 trees along 31 streets, choosing species by shade width at maturity, tolerance of compacted soil, and water demand. Each tree was given a watering schedule for its first three summers, funded from the pilot budget. The third measure was a change to the layout of two commercial streets, where parking bays were moved to open a corridor aligned with the prevailing sea breeze.",
            "Temperature was recorded by 36 fixed sensors, placed so that each measure had treated and untreated streets within 300 metres of each other. Readings were taken every ten minutes. The same sensors had recorded a baseline during the summer of 2021, before any work began.",
        ]),
        ("Results", [
            "By the third summer, average afternoon surface temperature on treated roofs was 4.1 degrees Celsius lower than on comparable untreated roofs. Air temperature at street level fell by a smaller margin: 0.9 degrees on streets with new trees alone, 1.2 degrees where roof coating was also applied nearby, and 1.6 degrees on the two streets that combined trees, coating and the breeze corridor.",
            "Night-time air temperature in the district fell from 3.1 degrees above the rural reference to 2.2 degrees above it, a reduction of 0.9 degrees. Heat-related emergency visits fell from 214 over the two baseline summers to 163 over the last two summers of the pilot, a drop of 24 percent. The pilot cannot show that the measures alone caused this fall, because the three summers differed in weather: 2023 was cooler than the baseline years, and 2024 was warmer.",
        ]),
        ("Table: temperature change by measure (summer 2024 against 2021)", [
            "Measure | Streets | Change in afternoon air temperature | Cost per street (EUR)",
            "Trees only | 19 | -0.9 C | 41,000",
            "Trees and roof coating | 10 | -1.2 C | 58,000",
            "Trees, coating and breeze corridor | 2 | -1.6 C | 96,000",
        ]),
        ("Limitations and next steps", [
            "Three summers is a short record, and the sensors were not randomly placed. Streets were selected because their roofs and soil could take the work, which may make them easier to cool than the district as a whole. Tree growth also continues for decades, so the shade measured in 2024 understates the long-term effect, while reflective coatings lose between 10 and 25 percent of their reflectance within three years as dirt accumulates.",
            "The city has asked for a five-year extension with a maintenance budget, an assessment of glare complaints near coated roofs, and a comparison district with no work at all.",
        ]),
    ],
    "canvas_stock.pdf": [
        ("Scanning at the dock: a stock-count rollout across four warehouses", None),
        ("Context", [
            "Northfield Logistics runs four regional warehouses holding 38,000 stock lines between them. Until 2023 each site counted stock by hand against a spreadsheet, once a week, with two staff reading codes aloud while a third typed. A full count took an average of 3 hours 10 minutes per site and was done on the quietest morning of the week, which meant dispatch was slow during the count.",
            "An audit in early 2023 compared the spreadsheet with a physical recount of 1,200 randomly chosen lines. It found a mismatch on 12.4 percent of them. Most errors were transposed digits and lines counted twice; a smaller number were real losses.",
        ]),
        ("What was built", [
            "The team built a barcode scanning app for the handheld devices the warehouses already owned. It uses React Native for the handheld and a Node service that writes each scan to the central inventory database within five minutes. A scan beeps when a code is unknown, and the app refuses a second scan of the same bay unless the supervisor releases it.",
            "The central database already held one record per stock line. The new service added a count table, so that every count keeps who scanned, which handheld, which bay and when. This is what lets a supervisor recount only the bays where two counts disagree.",
        ]),
        ("Rollout", [
            "The Leeds warehouse piloted the app for six weeks from March 2023. Staff were trained in a single 90-minute session. The other three sites adopted it in May, June and August, each a month after the one before, so that fixes from one site reached the next. Two defects found in Leeds, a slow search on large bays and a missing sound on one handheld model, were fixed before the Bristol rollout.",
            "Adoption was measured by the share of counts done with the app rather than the spreadsheet. It reached 100 percent at every site within three weeks of go-live, because the spreadsheet count was switched off on the go-live date.",
        ]),
        ("Results after twelve months", [
            "A full count now takes 22 minutes on average, down from 3 hours 10 minutes, a reduction of 88 percent. Counts moved from the quietest morning to a rolling schedule through the week, so no dispatch slowdown remains. The mismatch rate in the repeat audit of 1,200 lines fell from 12.4 percent to 1.1 percent.",
            "Stock write-offs fell from 2.3 percent of stock value in 2022 to 1.4 percent in 2024. Part of that is better counting and part is that errors are now found while the stock can still be traced; the audit cannot separate the two. The cost of the project was EUR 186,000, including EUR 24,000 for the Node service and EUR 31,000 for training time.",
        ]),
        ("Table: results by site", [
            "Site | Go-live | Count time before | Count time after | Mismatch after",
            "Leeds | March 2023 | 3 h 05 min | 21 min | 1.0%",
            "Bristol | May 2023 | 3 h 20 min | 24 min | 1.3%",
            "Glasgow | June 2023 | 3 h 12 min | 20 min | 0.9%",
            "Cardiff | August 2023 | 3 h 04 min | 23 min | 1.2%",
        ]),
        ("Lessons", [
            "Switching off the old process on go-live date mattered more than training. Sites that were allowed a parallel spreadsheet in the pilot used it for three weeks longer. Staff also asked for the supervisor release to be faster; the median release now takes 40 seconds. A remaining weakness is that the handheld loses its connection in two cold-store bays, where counts are saved on the device and sent later.",
        ]),
    ],
    "canvas_clinic.pdf": [
        ("Evening telehealth for a rural clinic network: a twelve-month evaluation", None),
        ("Problem", [
            "The Upper Valley clinic network serves 14,000 residents across 9 villages. Its three clinics close at 17:00, and the nearest emergency department is 62 kilometres away, about 80 minutes by road. In 2022 the network recorded 1,310 evening calls to its out-of-hours phone line; 29 percent ended in an ambulance dispatch, and a review judged that roughly one in three of those dispatches was for a condition a clinician could have assessed by video.",
        ]),
        ("The service", [
            "From February 2023 the network ran an evening video consultation service from 17:00 to 22:00, seven days a week, staffed by a rota of nurse practitioners working from home with a shared record system. Patients booked through the phone line or a web form. Villages with poor broadband were given a tablet and a data plan, held at the village pharmacy.",
            "A nurse practitioner could prescribe from a limited formulary, request a next-morning appointment, ask a village volunteer driver to collect a patient, or advise a dispatch. The service followed a written escalation protocol, reviewed by the medical director every quarter.",
        ]),
        ("Evaluation method", [
            "The evaluation compared the twelve months before the service with the twelve months after. It counted evening calls, dispatches, next-day appointments and patient-reported satisfaction on a five-point scale, collected by text message after each consultation. Response to the satisfaction survey was 58 percent. Because no similar network was available as a comparison, the evaluation cannot rule out other causes of change, such as the opening of a new road bridge in September 2023 that shortened ambulance journeys by 11 minutes.",
        ]),
        ("Findings", [
            "The service handled 2,046 consultations in twelve months, an average of 5.6 a night. Evening calls to the phone line fell from 1,310 to 880, since many patients now booked online. Ambulance dispatches after 17:00 fell from 380 to 241, a reduction of 37 percent. Median wait for a consultation was 14 minutes.",
            "Satisfaction averaged 4.6 out of 5. Patients over 65 rated the service 4.4, slightly below the 4.7 given by those under 40, and most of the lower scores mentioned difficulty with the tablet rather than with the consultation. 7 percent of consultations were ended early because of a failed video connection, and in 4 percent of cases the nurse practitioner arranged a dispatch after assessment.",
        ]),
        ("Table: evening service outcomes", [
            "Measure | Before | After",
            "Evening phone calls | 1,310 | 880",
            "Ambulance dispatches after 17:00 | 380 | 241",
            "Median wait | not recorded | 14 min",
            "Satisfaction (1 to 5) | not recorded | 4.6",
        ]),
        ("Costs and sustainability", [
            "Running costs were EUR 212,000 for the year, of which EUR 168,000 was nurse practitioner time. The network estimates that each avoided ambulance dispatch saves between EUR 520 and EUR 700 in regional ambulance costs, which would cover between 66 and 89 percent of the running cost if all 139 fewer dispatches were due to the service. That attribution is uncertain.",
            "The network has asked the regional health authority to fund a second year, and to extend the hours to 24:00 on Fridays and Saturdays, when evening demand peaks.",
        ]),
    ],
}

for name, sections in DOCS.items():
    doc = pymupdf.open()
    page = doc.new_page()
    y = 56
    def new_page():
        global page, y
        page = doc.new_page()
        y = 56
    def write(text, size, bold=False, gap=8):
        global y
        font = "hebo" if bold else "helv"
        rect = pymupdf.Rect(56, y, 539, 780)
        remaining = page.insert_textbox(rect, text, fontsize=size, fontname=font)
        if remaining < 0:
            new_page()
            page.insert_textbox(pymupdf.Rect(56, y, 539, 780), text, fontsize=size, fontname=font)
            remaining = 780 - y
        # insert_textbox returns the unused height; advance by what was used.
        used = (pymupdf.Rect(56, y, 539, 780).height - remaining)
        y += used + gap
    for heading, body in sections:
        if y > 700:
            new_page()
        write(heading, 16 if body is None else 13, bold=True, gap=10)
        for paragraph in body or []:
            if y > 740:
                new_page()
            write(paragraph.replace(" | ", "    "), 10.5, gap=6)
    doc.save(OUT / name)
    print(name, len(doc), "pages")
