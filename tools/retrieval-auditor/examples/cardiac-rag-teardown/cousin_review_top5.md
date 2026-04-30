# Top 5 cardiac retrieval findings for clinical review

Test setup: 50 cardiology USMLE-style clinical vignettes drawn from the MIRAGE benchmark, run against a corpus of 40 Wikipedia cardiology articles (1.03M chars), retrieved via sentence-transformers/MiniLM at top-K=5, audited by retrieval-auditor in dense profile.

Aggregate across the full 50: 66% of queries fired at least one pathology flag; 32% showed rank inversion; 48% showed score miscalibration; 34% retrieved cleanly. Median health 0.506.

These five are the most striking. Question for review: are the AI's retrieval failures clinically meaningful, or is the AI's behavior actually defensible in context?

## Finding 1: medqa/0380

**Health:** 0.10  ·  **Flags:** OFF_TOPIC, RANK_INVERSION, SCORE_MISCALIBRATED
**rankQualityR:** -0.511 (negative = top-ranked chunks LESS aligned than lower-ranked)
**scoreCalibrationR:** -0.595 (negative = retriever's confidence anti-correlates with TF-IDF alignment)

### Query (USMLE clinical vignette)

A 70-year-old obese male presents to the emergency department with shortness of breath and
cough of sudden onset. The patient states that his symptoms came on while he was sleeping.
The patient has a past medical history of type II diabetes and is currently taking
lisinopril, metformin, insulin, and fish oil. On physical exam, you note bipedal edema and
jugular venous distention (JVD). An EKG and chest radiographs are obtained (Figures A and
B). The patient is started on BIPAP and medical therapy and his symptoms improve rapidly.
Lab values are as follows.  Serum: Na+: 137 mEq/L K+: 3.2 mEq/L Cl-: 100 mEq/L HCO3-: 31
mEq/L BUN: 20 mg/dL Glucose: 120 mg/dL Creatinine: 1.2 mg/dL Ca2+: 10.9 mg/dL  Which of the
following is the best explanation of this patient's current presentation?

Options:
  A) Furosemide
  B) Hydrochlorothiazide
  C) Renal tubular acidosis type II
  D) Renal tubular acidosis type IV
  Correct answer: B

### What the retriever returned (top-5)

**Rank 1**  (retriever score 0.579, TF-IDF alignment 0.015)
> differentiate between causes of dyspnea due to heart failure from other causes of dyspnea. If a myocardial infarction is suspected, various cardiac markers may be used.  Blood tests routinely performed include electrolytes ( sodium , potassium ), measures of kidney function , liver function tests , thyroid function tests , a complete blood count , and often C-reactive protein if infection is suspected.  Hyponatremia (low serum sodium concentration) is common in heart failure....

**Rank 2**  (retriever score 0.505, TF-IDF alignment 0.043)
> e likely and prognosis is worse. [ 42 ]  Heart damage can predispose a person to develop heart failure later in life and has many causes including systemic viral infections (e.g., HIV ), chemotherapeutic agents such as daunorubicin , cyclophosphamide , trastuzumab and substance use disorders of substances such as alcohol , cocaine , and methamphetamine . An uncommon cause is exposure to certain toxins such as lead and cobalt . Additionally, infiltrative disorders such as amyl...

**Rank 3**  (retriever score 0.490, TF-IDF alignment 0.055)
> ed) and a gallop rhythm (additional heart sounds), which may be heard as a sign of increased blood flow or increased intracardiac pressure. Heart murmurs may indicate the presence of valvular heart disease, either as a cause (e.g., aortic stenosis ) or as a consequence (e.g., mitral regurgitation ) of heart failure. [ 33 ]  Reverse insufficiency of the left ventricle causes congestion in the blood vessels of the lungs so that symptoms are predominantly respiratory. Reverse in...

**Rank 4**  (retriever score 0.481, TF-IDF alignment 0.139)
> ences for each patient is still a matter of debate but in the presence of complex lesions and significant Left Main Disease, and in diabetic patients, CABG seems to offer better results in patients than PCI. [ 11 ] [ 10 ] Strong indications for CABG also include symptomatic patients and those with impaired LV function. [ 10 ]  The most common complications of CABG are postoperative bleeding, heart failure, atrial fibrillation (a form of arrhythmia), stroke , kidney dysfunctio...

**Rank 5**  (retriever score 0.478, TF-IDF alignment 0.043)
> se to normal reduce the increased risk associated with AF. Diastolic dysfunction is also associated with AF, which increases left atrial pressure, left atrial volume, size, and left ventricular hypertrophy, characteristic of chronic hypertension. All atrial remodeling is related to heterogeneous conduction and the formation of re-entrant electric conduction from the pulmonary veins . [ 7 ] [ 56 ]  There is a relationship between risk factors such as obesity and hypertension, ...

---

## Finding 2: medqa/0448

**Health:** 0.41  ·  **Flags:** OFF_TOPIC, RANK_INVERSION, SCORE_MISCALIBRATED
**rankQualityR:** -0.178 (negative = top-ranked chunks LESS aligned than lower-ranked)
**scoreCalibrationR:** +0.010 (negative = retriever's confidence anti-correlates with TF-IDF alignment)

### Query (USMLE clinical vignette)

A 69-year-old male with a longstanding history of hypertension and high cholesterol presents
with abdominal pain and ‘bruising on his feet’. The patient states that his symptoms started
about a week ago and have steadily worsened. He describes the abdominal pain as mild to
moderate, dull, and deeply localized to the umbilical region. Past medical history is
significant for 2 transient ischemic attacks 6 months prior, characterized by a sudden
right-sided weakness and trouble speaking but recovered fully within 30 minutes. Current
medications are sildenafil 100 mg orally as needed. Patient reports a 30-pack-year smoking
history and heavy alcohol use on the weekends. Review of systems is significant for
decreased appetite and feeling easily full. Vitals are temperature 37°C (98.6°F), blood
pressure 155/89 mm Hg, pulse 89/min, respirations 16/min, and oxygen saturation 98% on room
air. On physical examination, the patient is alert and cooperative. The cardiac exam is
normal. Lungs are clear to auscultation. Carotid bruit present on the right. The abdomen is
soft and nontender. Bowel sounds present. A pulsatile abdominal mass is felt in the lower
umbilical region. Patient’s feet have the following appearance seen in the picture.
Abdominal ultrasound reveals the presence of an abdominal aortic aneurysm (AAA). Contrast CT
reveals a small, unruptured AAA (diameter 4.1 cm). High flow supplemental oxygen and fluid
resuscitation are initiated. Morphine sulfate and metoprolol are administered. Which of the
following is the best course of treatment for this patient?

Options:
  A) Discharge with clinical surveillance and ultrasound every 6 months
  B) Elective endovascular repair
  C) Elective open surgical repair
  D) Emergency open surgical repair
  Correct answer: D

### What the retriever returned (top-5)

**Rank 1**  (retriever score 0.486, TF-IDF alignment 0.081)
> h thrombolysis ("clot buster" medication), whichever is available. In the absence of ST-segment elevation, heart damage is detected by cardiac markers (blood tests that identify heart muscle damage). If there is evidence of damage ( infarction ), the chest pain is attributed to a "non-ST elevation MI" (NSTEMI). If there is no evidence of damage, the term "unstable angina" is used. This process usually necessitates hospital admission and close observation on a coronary care un...

**Rank 2**  (retriever score 0.486, TF-IDF alignment 0.118)
> troduced and developed by Michael E. DeBakey , Denton Cooley , and Oscar Creech, cardiac surgeons associated with the Baylor College of Medicine , Houston, Texas, in 1954. DeBakey developed aortic dissection himself at age 97 in 2005, [ 3 ] and underwent surgery in 2006. [ 55 ] Endovascular treatment of aortic dissection was developed in the 1990s. [ 3 ]  Pulmonary embolism ( PE ) is a blockage of an artery in the lungs by a substance that has moved from elsewhere in the body...

**Rank 3**  (retriever score 0.485, TF-IDF alignment 0.100)
> relor, and heparin (usually a low-molecular weight heparin ), with intravenous nitroglycerin and opioids if the pain persists. The heparin-like drug known as fondaparinux appears to be better than enoxaparin . [ 25 ]  If there is no evidence of ST segment elevation on the electrocardiogram , delaying urgent angioplasty until the next morning is not inferior to doing so immediately. [ 26 ] Using statins in the first 14 days after ACS reduces the risk of further ACS. [ 27 ]  Co...

**Rank 4**  (retriever score 0.484, TF-IDF alignment 0.096)
> eatment for hypertension and diabetes , avoiding smoking and controlling cholesterol levels; in patients with significant risk factors, aspirin has been shown to reduce the risk of cardiovascular events. Secondary prevention is discussed in myocardial infarction . [ 20 ]  After a ban on smoking in all enclosed public places was introduced in Scotland in March 2006, there was a 17% reduction in hospital admissions for acute coronary syndrome. 67% of the decrease occurred in no...

**Rank 5**  (retriever score 0.484, TF-IDF alignment 0.100)
> ronic pericarditis however is less common, a form of which is constrictive pericarditis . The following is the clinical classification of acute vs. chronic: [ citation needed ]  The treatment in viral or idiopathic pericarditis is with aspirin , [ 11 ] or non-steroidal anti-inflammatory drugs (NSAIDs such as ibuprofen ). [ 4 ] Colchicine may be added to the above as it decreases the risk of further episodes of pericarditis. [ 4 ] [ 24 ] The drug that helps treat the condition...

---

## Finding 3: medqa/0757

**Health:** 0.02  ·  **Flags:** OUT_OF_DISTRIBUTION, RANK_INVERSION, SCORE_MISCALIBRATED
**rankQualityR:** -0.702 (negative = top-ranked chunks LESS aligned than lower-ranked)
**scoreCalibrationR:** -0.524 (negative = retriever's confidence anti-correlates with TF-IDF alignment)

### Query (USMLE clinical vignette)

An 18-year-old woman is brought to the emergency department because of lightheadedness and a
feeling of dizziness. She has had nausea, occasional episodes of vomiting, myalgia, and a
generalized rash for the past week. She also reports feeling lethargic. She has no shortness
of breath. There is no family history of serious illness. She appears ill. Her temperature
is 39.1°C (102.3°F), pulse is 118/min, and blood pressure is 94/60 mm Hg. Cardiac
examination shows no abnormalities. There is a widespread erythematous rash on the trunk and
extremities with skin peeling on the palms and soles. Laboratory studies show: Hemoglobin
13.6 g/dL Leukocyte count 19,300/mm3 Platelet count 98,000/mm3 Serum Urea nitrogen 47 mg/dL
Glucose 88 mg/dL Creatinine 1.8 mg/dL Total bilirubin 2.1 mg/dL AST 190 U/L ALT 175 U/L
Urinalysis shows no abnormalities. Further evaluation of this patient's history is most
likely to reveal which of the following?"

Options:
  A) Recent hiking trip
  B) Intravenous heroin abuse
  C) Exposure to a patient with mengingococcemia
  D) Currently menstruating
  Correct answer: D

### What the retriever returned (top-5)

**Rank 1**  (retriever score 0.499, TF-IDF alignment 0.000)
> highly variable, [ 5 ] the typical symptoms are pain, swelling , and redness. However, these symptoms might not manifest in the lower limbs of those unable to walk. [ 22 ] In those who are able to walk, DVT can reduce one's ability to do so. [ 23 ] The pain can be described as throbbing and can worsen with weight-bearing, prompting one to bear more weight with the unaffected leg. [ 21 ] [ 24 ]  Additional signs and symptoms include tenderness, pitting edema ( see image ), dil...

**Rank 2**  (retriever score 0.487, TF-IDF alignment 0.033)
> r disease. The incidence of this disease is about one in 500 for heterozygotes, and one in 1,000,000 for homozygotes. [ 21 ]  HLPIIa is a rare genetic disorder characterized by increased levels of LDL cholesterol in the blood due to the lack of uptake (no Apo B receptors) of LDL particles. This pathology, however, is the second-most common disorder of the various hyperlipoproteinemias, with individuals with a heterozygotic predisposition of one in every 500 and individuals wi...

**Rank 3**  (retriever score 0.473, TF-IDF alignment 0.088)
> DL (β-VLDL). Its prevalence has been estimated to be approximately 1 in 10,000. [ 15 ]  It is associated with hypercholesterolemia (typically 8–12 mmol/L), hypertriglyceridemia (typically 5–20 mmol/L), a normal ApoB concentration, and two types of skin signs (palmar xanthomata or orange discoloration of skin creases, and tuberoeruptive xanthomata on the elbows and knees). It is characterized by the early onset of cardiovascular disease and peripheral vascular disease. Remnant...

**Rank 4**  (retriever score 0.433, TF-IDF alignment 0.041)
> tiplatelet drugs . Some bruising is common, but occasionally a hematoma may form. This may delay hospital discharge as flow from the artery into the hematoma may continue (pseudoaneurysm) which requires surgical repair. Infection at the skin puncture site is rare and dissection (tearing) in the interior wall of an arterial blood vessel is uncommon. Allergic reaction to the contrast dye used is possible, but has been reduced with the newer agents. [ 11 ] Deterioration of kidne...

**Rank 5**  (retriever score 0.431, TF-IDF alignment 0.072)
> tis-causing microorganisms.  Signs and symptoms include fever, chills, sweating, malaise, weakness, anorexia, weight loss, splenomegaly , flu-like feeling, cardiac murmur, heart failure, petechia (red spots on the skin), Osler's nodes (subcutaneous nodules found on hands and feet), Janeway lesions (nodular lesions on palms and soles), and Roth's spots (retinal hemorrhages).  Infective endocarditis is an infection of the inner surface of the heart , usually the valves . [ 3 ] ...

---

## Finding 4: medqa/0730

**Health:** 0.08  ·  **Flags:** OFF_TOPIC, RANK_INVERSION, SCORE_MISCALIBRATED
**rankQualityR:** -0.583 (negative = top-ranked chunks LESS aligned than lower-ranked)
**scoreCalibrationR:** -0.415 (negative = retriever's confidence anti-correlates with TF-IDF alignment)

### Query (USMLE clinical vignette)

A 5-year-old Syrian immigrant and her family present for an immigration physical. Her mother
describes photophobia, bilateral lacrimation, eye itching, and eyelid swelling for the last
week. She is known to have an allergy to cephalosporins. She was born at 39 weeks gestation
via spontaneous vaginal delivery. She has met all of her developmental milestones and most
of her vaccines. Her vital signs are as follows: blood pressure 105/60 mm Hg, heart rate
98/min, respiratory rate 18/min, and temperature 37.0°C (98.6°F). The physical examination
is mostly normal except for her eye exam as presented in the image below. Which of the
following statements is true regarding treatment of this patient’s condition?

Options:
  A) A third-generation cephalosporin would be the best treatment option in case the child did not have an actual allergy.
  B) The child should be treated with topical bacitracin.
  C) The best treatment option is oral tetracycline.
  D) The child should be administered a single dose of oral azithromycin.
  Correct answer: D

### What the retriever returned (top-5)

**Rank 1**  (retriever score 0.427, TF-IDF alignment 0.045)
> a ; such patients should avoid exposure to the sun and use sunscreen that protects against ultraviolet -A and -B. The discoloration will slowly improve upon cessation of the medication, however, the skin color may not return completely. [ 60 ]  Use during pregnancy may result in a number of problems in the infant including thyroid problems, heart problems, neurological problems, and preterm birth. [ 61 ] Use during breastfeeding is generally not recommended though one dose ma...

**Rank 2**  (retriever score 0.397, TF-IDF alignment 0.010)
> s to prevent it (including a Surgeon General 's warning, and changes to the prescribing information of aspirin-containing drugs) were implemented, aspirin taken by children declined considerably in the United States, as did the number of reported cases of Reye syndrome; a similar decline was found in the United Kingdom after warnings against pediatric aspirin use were issued. [ 232 ] The US Food and Drug Administration recommends aspirin (or aspirin-containing products) shoul...

**Rank 3**  (retriever score 0.365, TF-IDF alignment 0.065)
> d that the administration of amiodarone, even at lower therapeutic doses, has been associated with the development of a condition mimicking alcoholic cirrhosis. This condition, often referred to as pseudo-alcoholic cirrhosis, presents with similar histopathological features to those observed in patients with alcoholic cirrhosis. [ 58 ] [ 59 ] However, this extreme adverse event manifestation—pseudo-alcoholic cirrhosis caused by low dose amiodarone—is very rare. [ 36 ]  Long-t...

**Rank 4**  (retriever score 0.358, TF-IDF alignment 0.020)
> ophilic conditions increase the risk of skin necrosis , which is a rare but serious side effect associated with warfarin. [ 40 ]  Warfarin is contraindicated in pregnancy, as it passes through the placental barrier and may cause bleeding in the fetus; warfarin use during pregnancy is commonly associated with spontaneous abortion , stillbirth , neonatal death , and preterm birth . [ 41 ] Coumarins (such as warfarin) are also teratogens , that is, they cause birth defects ; the...

**Rank 5**  (retriever score 0.355, TF-IDF alignment 0.122)
> r disease. The incidence of this disease is about one in 500 for heterozygotes, and one in 1,000,000 for homozygotes. [ 21 ]  HLPIIa is a rare genetic disorder characterized by increased levels of LDL cholesterol in the blood due to the lack of uptake (no Apo B receptors) of LDL particles. This pathology, however, is the second-most common disorder of the various hyperlipoproteinemias, with individuals with a heterozygotic predisposition of one in every 500 and individuals wi...

---

## Finding 5: medqa/1079

**Health:** 0.29  ·  **Flags:** OFF_TOPIC, RANK_INVERSION, SCORE_MISCALIBRATED
**rankQualityR:** -0.281 (negative = top-ranked chunks LESS aligned than lower-ranked)
**scoreCalibrationR:** -0.320 (negative = retriever's confidence anti-correlates with TF-IDF alignment)

### Query (USMLE clinical vignette)

A 65-year-old man presents with left-sided numbness, diplopia, and blurring of vision. The
diplopia is more prominent on his left-side lateral gaze. He denies having fever, headache,
ocular pain, lacrimation, changes in color vision, or limb weakness. He has a past medical
history of type-2 diabetes mellitus, hypertension, hypercholesterolemia, and ischemic heart
disease. In addition, he had an ischemic stroke 9 years ago, from which he recovered
completely with physiotherapy and rehabilitation. He has a history of a 56-pack-year
cigarette smoking habit. His medications include aspirin, atorvastatin, glimepiride,
metformin, metoprolol, and ramipril. The mental status examination is unremarkable. His
muscle strength is normal in all 4 limbs. His sensations are decreased on his left side,
including his face. The examination of extraocular movements is shown in the image. A lesion
in which of the following locations explains the findings during eye examination?

Options:
  A) Cavernous sinus
  B) Corticospinal tract before pyramidal decussation
  C) Frontal eye field
  D) Medial longitudinal fasciculus
  Correct answer: D

### What the retriever returned (top-5)

**Rank 1**  (retriever score 0.502, TF-IDF alignment 0.019)
> bout 1 in 10 individuals may complain of a bluish halo. Anterior subcapsular lens deposits are relatively common (50%) in higher doses (greater than 600 mg/day) after 6 months of treatment. Optic neuropathy , nonarteritic anterior ischemic optic neuropathy (N-AION), occurs in 1–2% of people and is not dosage dependent. [ 55 ] Bilateral optic disc swelling and mild and reversible visual field defects can also occur.  Abnormal liver enzyme results are common in people taking am...

**Rank 2**  (retriever score 0.495, TF-IDF alignment 0.130)
> , tinnitus (buzzing or hissing in the ears), altered vision or fainting episodes . [ 21 ] These symptoms, however, might be related to associated anxiety rather than the high blood pressure itself. [ 22 ]  Long-standing untreated hypertension can cause organ damage with signs such as changes in the optic fundus seen by ophthalmoscopy . [ 23 ] The severity of hypertensive retinopathy correlates roughly with the duration or the severity of the hypertension. [ 21 ] Other hyperte...

**Rank 3**  (retriever score 0.472, TF-IDF alignment 0.088)
> eatment for hypertension and diabetes , avoiding smoking and controlling cholesterol levels; in patients with significant risk factors, aspirin has been shown to reduce the risk of cardiovascular events. Secondary prevention is discussed in myocardial infarction . [ 20 ]  After a ban on smoking in all enclosed public places was introduced in Scotland in March 2006, there was a 17% reduction in hospital admissions for acute coronary syndrome. 67% of the decrease occurred in no...

**Rank 4**  (retriever score 0.471, TF-IDF alignment 0.132)
> was the first doctor to document this by ECG in 1909. [ 3 ]  Atrial fibrillation is usually accompanied by symptoms related to a rapid heart rate . Rapid and irregular heart rates may be perceived as the sensation of the heart beating too fast, irregularly, or skipping beats ( palpitations ) or exercise intolerance .  Other possible symptoms include congestive heart failure symptoms such as fatigue, shortness of breath , or swelling . Loss of consciousness can also occur due ...

**Rank 5**  (retriever score 0.469, TF-IDF alignment 0.061)
> ion containing vitamin C was found to cause less stomach damage than aspirin alone. [ 225 ] [ 226 ]  It is a widespread habit among eye specialists (ophthalmologists) to prescribe aspirin as an add-on medication for patients with retinal vein occlusion (RVO), such as central retinal vein occlusion (CRVO) and branch retinal vein occlusion (BRVO). [ 227 ] The reason for this widespread use is the evidence of its proven effectiveness in major systemic venous thrombotic disorders...

---
