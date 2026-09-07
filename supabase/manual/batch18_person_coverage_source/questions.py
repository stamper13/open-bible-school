# -*- coding: utf-8 -*-
"""Batch 18: person-coverage questions.

Every fact below was read out of the local Berean Standard Bible USFM
before the item was written; `reference` is the verse that was checked.
Distractors are misconception-based: each is a person a learner could
plausibly confuse with the answer, not filler.
"""

D = lambda text, plaus, code, rel: (text, plaus, code, rel)

MCQS = [
# ---------------------------------------------------------------- David's circle
dict(slug="zeruiah_three_sons", book="1CH", chapter=2, reference="1 Chronicles 2:16; 2 Samuel 2:18",
     dim="characters_lineage", covers=["Zeruiah", "Abishai", "Asahel"],
     prompt="Joab, Abishai, and Asahel were the three sons of which woman?",
     answer="Zeruiah",
     distractors=[
        D("Abigail", "high", "sister_of_zeruiah_confused_for_her", "same_generation"),
        D("Ahinoam", "high", "davids_wife_confused_for_his_sister", "same_generation"),
        D("Bathsheba", "medium", "most_famous_woman_of_davids_court", "same_generation")],
     explanation="1 Chronicles 2:16 names Zeruiah and Abigail as sisters, and lists Zeruiah's sons as Abishai, Joab, and Asahel. Zeruiah's name, not their father's, identifies these three throughout Samuel.",
     difficulty=610, irt_b=0.85, imp_c=72, imp_x=78),

dict(slug="abishai_sauls_camp", book="1SA", chapter=26, reference="1 Samuel 26:6",
     dim="characters_lineage", covers=["Abishai"],
     prompt="When David asked who would go down with him into Saul's camp by night, who answered, \"I will go with you\"?",
     answer="Abishai son of Zeruiah",
     distractors=[
        D("Ahimelech the Hittite", "high", "the_other_man_david_asked", "same_event"),
        D("Joab son of Zeruiah", "high", "more_famous_brother_assumed", "same_generation"),
        D("Asahel son of Zeruiah", "medium", "third_brother_assumed", "same_generation")],
     explanation="David put the question to Ahimelech the Hittite and to Abishai son of Zeruiah, and it was Abishai who volunteered. Joab, the best known of the brothers, is not in the scene.",
     difficulty=650, irt_b=1.0, imp_c=68, imp_x=72),

dict(slug="uzzah_ark_struck", book="2SA", chapter=6, reference="2 Samuel 6:6-7",
     dim="characters_lineage", covers=["Uzzah"],
     prompt="Who took hold of the ark of God when the oxen stumbled, and was struck down on the spot?",
     answer="Uzzah son of Abinadab",
     distractors=[
        D("Ahio son of Abinadab", "high", "brother_guiding_the_same_cart", "same_event"),
        D("Obed-edom the Gittite", "high", "next_man_the_ark_is_given_to", "same_event"),
        D("Eleazar son of Abinadab", "medium", "earlier_keeper_of_the_ark", "same_generation")],
     explanation="Uzzah and his brother Ahio were guiding the new cart. When the oxen stumbled Uzzah reached out to steady the ark and God struck him down, so David named the place Perez-uzzah.",
     difficulty=560, irt_b=0.6, imp_c=74, imp_x=80),

dict(slug="obed_edom_ark_house", book="2SA", chapter=6, reference="2 Samuel 6:10-12",
     dim="characters_lineage", covers=["Obed-edom"],
     prompt="In whose house did the ark stay three months, so that the LORD blessed him and all his household?",
     answer="Obed-edom the Gittite",
     distractors=[
        D("Abinadab of Kiriath-jearim", "high", "previous_house_that_held_the_ark", "same_event"),
        D("Ahimelech the Hittite", "medium", "another_foreigner_in_davids_orbit", "same_role"),
        D("Ittai the Gittite", "high", "the_other_famous_gittite", "same_role")],
     explanation="After Uzzah's death David was unwilling to bring the ark on to the City of David, so he turned it aside to Obed-edom the Gittite. News of the blessing on that house is what moved David to complete the journey.",
     difficulty=640, irt_b=0.95, imp_c=70, imp_x=76),

dict(slug="benaiah_lion_pit", book="2SA", chapter=23, reference="2 Samuel 23:20",
     dim="characters_lineage", covers=["Benaiah"],
     prompt="Which of David's warriors went down into a pit on a snowy day and killed a lion?",
     answer="Benaiah son of Jehoiada",
     distractors=[
        D("Eleazar son of Dodo the Ahohite", "high", "adjacent_entry_in_the_same_list", "same_role"),
        D("Shammah son of Agee the Hararite", "high", "adjacent_entry_in_the_same_list", "same_role"),
        D("Abishai son of Zeruiah", "medium", "best_known_of_davids_warriors", "same_role")],
     explanation="The roll of David's mighty men credits Benaiah son of Jehoiada with striking down two champions of Moab and killing a lion in a pit on a snowy day. Eleazar and Shammah are neighbouring entries in the same list.",
     difficulty=690, irt_b=1.15, imp_c=66, imp_x=70),

dict(slug="benaiah_over_army", book="1KI", chapter=2, reference="1 Kings 2:34-35",
     dim="characters_lineage", covers=["Benaiah", "Amasa"],
     prompt="After Joab was put to death, whom did Solomon appoint over the army in his place?",
     answer="Benaiah son of Jehoiada",
     distractors=[
        D("Amasa son of Ithra the Ishmaelite", "high", "earlier_rival_commander_already_dead", "same_role"),
        D("Abishai son of Zeruiah", "high", "joabs_brother_assumed_to_succeed", "same_role"),
        D("Adoniram son of Abda", "medium", "another_named_officer_of_solomon", "same_role")],
     explanation="Benaiah struck down Joab and was appointed in his place over the army, as Zadok was appointed in Abiathar's place as priest. Amasa, whom Absalom had made commander, had already been killed by Joab.",
     difficulty=670, irt_b=1.05, imp_c=68, imp_x=72),

dict(slug="achish_gath_refuge", book="1SA", chapter=27, reference="1 Samuel 27:2",
     dim="characters_lineage", covers=["Achish"],
     prompt="David took his six hundred men and went over to which foreign king for refuge from Saul?",
     answer="Achish king of Gath",
     distractors=[
        D("Nahash king of Ammon", "high", "another_foreign_king_in_samuel", "same_role"),
        D("Talmai king of Geshur", "high", "the_king_absalom_fled_to", "same_role"),
        D("Hanun king of Ammon", "medium", "successor_of_nahash", "same_role")],
     explanation="David crossed to Achish son of Maoch, king of Gath, and lived in Philistine territory. Talmai of Geshur is the king Absalom later fled to; the Ammonite kings belong to David's wars, not his exile.",
     difficulty=600, irt_b=0.8, imp_c=70, imp_x=74),

dict(slug="ziba_mephibosheth", book="2SA", chapter=9, reference="2 Samuel 9:2-3",
     dim="characters_lineage", covers=["Ziba"],
     prompt="Which servant of the house of Saul was summoned to tell David whether anyone of Saul's line remained?",
     answer="Ziba",
     distractors=[
        D("Shimei son of Gera", "high", "other_saul_clansman_who_meets_david", "same_book"),
        D("Machir son of Ammiel", "high", "the_man_who_had_sheltered_mephibosheth", "same_event"),
        D("Barzillai the Gileadite", "medium", "another_man_who_serves_david", "same_book")],
     explanation="Ziba, a servant of Saul's household, was brought to David and pointed him to Mephibosheth. Machir of Lo-debar had been sheltering Mephibosheth, but it is Ziba whom David questions.",
     difficulty=630, irt_b=0.9, imp_c=66, imp_x=72),

dict(slug="shimei_curses_bahurim", book="2SA", chapter=16, reference="2 Samuel 16:5",
     dim="characters_lineage", covers=["Shimei"],
     prompt="As David fled from Absalom, which man of Saul's family came out of Bahurim yelling curses at him?",
     answer="Shimei son of Gera the Benjamite",
     distractors=[
        D("Ziba the servant of Mephibosheth", "high", "man_met_on_the_same_road_just_before", "same_event"),
        D("Sheba son of Bichri the Benjamite", "high", "other_benjamite_who_revolts_against_david", "same_book"),
        D("Mephibosheth son of Jonathan", "medium", "sauls_heir_suspected_of_disloyalty", "same_event")],
     explanation="Shimei son of Gera, of the house of Saul, cursed David at Bahurim. Ziba had met David with provisions a little earlier on the same road, and Sheba son of Bichri raises a separate Benjamite revolt afterwards.",
     difficulty=620, irt_b=0.85, imp_c=70, imp_x=76),

dict(slug="barzillai_mahanaim", book="2SA", chapter=17, reference="2 Samuel 17:27; 19:31",
     dim="characters_lineage", covers=["Barzillai"],
     prompt="Which aged Gileadite from Rogelim supplied David at Mahanaim and later escorted him over the Jordan?",
     answer="Barzillai the Gileadite",
     distractors=[
        D("Machir son of Ammiel", "high", "named_alongside_him_in_the_same_verse", "same_event"),
        D("Shobi son of Nahash", "high", "named_alongside_him_in_the_same_verse", "same_event"),
        D("Ittai the Gittite", "medium", "another_loyal_supporter_in_the_flight", "same_book")],
     explanation="Three men met David at Mahanaim: Shobi, Machir, and Barzillai. Only Barzillai of Rogelim is the one who later came down to escort the king back across the Jordan.",
     difficulty=700, irt_b=1.2, imp_c=64, imp_x=70),

dict(slug="ittai_refuses_return", book="2SA", chapter=15, reference="2 Samuel 15:19-22",
     dim="characters_lineage", covers=["Ittai"],
     prompt="Which foreigner did David tell to turn back because he was an exile, yet he insisted on going with the king?",
     answer="Ittai the Gittite",
     distractors=[
        D("Obed-edom the Gittite", "high", "the_other_gittite_in_davids_story", "same_role"),
        D("Uriah the Hittite", "high", "best_known_foreigner_in_davids_service", "same_role"),
        D("Ahimelech the Hittite", "medium", "another_foreign_soldier_with_david", "same_role")],
     explanation="David urged Ittai the Gittite to go back and stay with the new king, since he was both a foreigner and an exile. Ittai swore to stay with David wherever he went.",
     difficulty=680, irt_b=1.1, imp_c=64, imp_x=70),

dict(slug="ahimaaz_runs_news", book="2SA", chapter=18, reference="2 Samuel 18:19-23",
     dim="characters_lineage", covers=["Ahimaaz"],
     prompt="Which son of Zadok begged Joab to let him run and carry the news after Absalom's defeat?",
     answer="Ahimaaz son of Zadok",
     distractors=[
        D("Jonathan son of Abiathar", "high", "the_other_priests_son_who_ran_messages", "same_role"),
        D("the Cushite runner", "high", "the_man_joab_actually_sent_first", "same_event"),
        D("Joab son of Zeruiah", "medium", "the_commander_who_refused_the_request", "same_event")],
     explanation="Ahimaaz son of Zadok pressed to run with the news. Joab first sent the Cushite instead, and only afterwards let Ahimaaz go, so that Ahimaaz outran him.",
     difficulty=710, irt_b=1.25, imp_c=62, imp_x=68),

dict(slug="amasa_absalom_commander", book="2SA", chapter=17, reference="2 Samuel 17:25; 20:9-10",
     dim="characters_lineage", covers=["Amasa"],
     prompt="Whom did Absalom appoint over the army in place of Joab, and whom Joab later killed while greeting him?",
     answer="Amasa",
     distractors=[
        D("Abishai", "high", "joabs_brother_and_fellow_commander", "same_role"),
        D("Ahithophel", "high", "absaloms_best_known_adviser", "same_event"),
        D("Sheba son of Bichri", "medium", "the_rebel_amasa_was_sent_to_pursue", "same_book")],
     explanation="Absalom set Amasa over the army in Joab's place. After the revolt, Joab took Amasa by the beard as if to kiss him and struck him down. Ahithophel was Absalom's counsellor, not his general.",
     difficulty=690, irt_b=1.15, imp_c=64, imp_x=70),

dict(slug="nahash_jabesh_gilead", book="1SA", chapter=11, reference="1 Samuel 11:1",
     dim="characters_lineage", covers=["Nahash"],
     prompt="Which Ammonite king laid siege to Jabesh-gilead, the crisis that launched Saul's first victory?",
     answer="Nahash the Ammonite",
     distractors=[
        D("Hanun the Ammonite", "high", "his_son_who_fights_david_later", "same_generation"),
        D("Agag the Amalekite", "high", "the_king_saul_spares_in_the_next_war", "same_role"),
        D("Achish king of Gath", "medium", "philistine_king_of_the_same_era", "same_role")],
     explanation="Nahash the Ammonite besieged Jabesh-gilead and demanded the right eye of every man. The Spirit rushed on Saul and he delivered the city. Hanun, who humiliates David's envoys, is Nahash's son.",
     difficulty=640, irt_b=0.95, imp_c=68, imp_x=72),

dict(slug="hadadezer_zobah", book="2SA", chapter=8, reference="2 Samuel 8:3, 9",
     dim="characters_lineage", covers=["Hadadezer", "Toi"],
     prompt="Which king of Zobah did David defeat as he marched to restore his dominion at the Euphrates?",
     answer="Hadadezer son of Rehob",
     distractors=[
        D("Toi king of Hamath", "high", "the_king_who_congratulates_david_after", "same_event"),
        D("Rezin king of Aram", "high", "later_aramean_king_confused_for_him", "near_chronology"),
        D("Ben-hadad king of Aram", "medium", "best_known_aramean_royal_name", "same_role")],
     explanation="David defeated Hadadezer son of Rehob, king of Zobah, at the Euphrates. Toi of Hamath, Hadadezer's enemy, then sent his son to greet David. Rezin and Ben-hadad belong to later Aramean history.",
     difficulty=720, irt_b=1.3, imp_c=60, imp_x=66),

dict(slug="abishag_shunammite", book="1KI", chapter=1, reference="1 Kings 1:3",
     dim="characters_lineage", covers=["Abishag"],
     prompt="Which young Shunammite woman was sought throughout Israel to attend the aged King David?",
     answer="Abishag the Shunammite",
     distractors=[
        D("Abigail the Carmelite", "high", "similar_name_and_davids_wife", "same_generation"),
        D("Ahinoam of Jezreel", "high", "davids_other_named_wife", "same_generation"),
        D("Bathsheba daughter of Eliam", "medium", "the_queen_present_in_the_same_chapter", "same_event")],
     explanation="Servants searched all Israel for a beautiful girl and found Abishag the Shunammite, who cared for David in his old age. Adonijah's later request for her is what costs him his life.",
     difficulty=650, irt_b=1.0, imp_c=62, imp_x=68),

# ------------------------------------------------------------- divided kingdom
dict(slug="ahaziah_israel_lattice", book="2KI", chapter=1, reference="2 Kings 1:2",
     dim="characters_lineage", covers=["Ahaziah"],
     prompt="Which king of Israel fell through the lattice of his upper room and sent to inquire of Baal-zebub of Ekron?",
     answer="Ahaziah son of Ahab",
     distractors=[
        D("Ahaziah son of Jehoram", "high", "the_king_of_judah_with_the_same_name", "same_generation"),
        D("Joram son of Ahab", "high", "his_brother_who_reigns_after_him", "same_generation"),
        D("Jehoram son of Jehoshaphat", "medium", "the_judahite_king_of_the_parallel_line", "same_generation")],
     explanation="Two kings named Ahaziah reign in this period. The one who fell through the lattice and sent to Baal-zebub is Ahaziah of Israel, son of Ahab. Ahaziah of Judah is son of Jehoram.",
     difficulty=730, irt_b=1.35, imp_c=70, imp_x=74),

dict(slug="ahaziah_judah_jehu", book="2KI", chapter=9, reference="2 Kings 8:25; 9:27",
     dim="characters_lineage", covers=["Ahaziah", "Jehoram", "Joram"],
     prompt="Which king of Judah did Jehu's men shoot on the Ascent of Gur, so that he fled to Megiddo and died there?",
     answer="Ahaziah son of Jehoram",
     distractors=[
        D("Joram son of Ahab", "high", "killed_by_jehu_in_the_same_episode", "same_event"),
        D("Jehoram son of Jehoshaphat", "high", "his_father_confused_for_him", "same_generation"),
        D("Amaziah son of Joash", "medium", "another_judahite_king_killed_in_flight", "same_role")],
     explanation="Jehu killed Joram of Israel first, then pursued Ahaziah of Judah, son of Jehoram, who was shot near Ibleam and died at Megiddo. The near-identical royal names in the two kingdoms are the trap.",
     difficulty=750, irt_b=1.45, imp_c=68, imp_x=72),

dict(slug="baasha_kills_nadab", book="1KI", chapter=15, reference="1 Kings 15:27",
     dim="characters_lineage", covers=["Baasha"],
     prompt="Who conspired against Nadab at Gibbethon of the Philistines and took the throne of Israel?",
     answer="Baasha son of Ahijah",
     distractors=[
        D("Zimri commander of the chariots", "high", "the_next_usurper_at_the_same_place", "near_chronology"),
        D("Omri commander of the army", "high", "another_commander_who_seizes_the_throne", "near_chronology"),
        D("Jehu son of Nimshi", "medium", "the_best_known_usurper_of_israel", "same_role")],
     explanation="Baasha son of Ahijah struck down Nadab while Israel was besieging Gibbethon, and wiped out the house of Jeroboam. Gibbethon is also where Omri is later proclaimed king, which invites the confusion.",
     difficulty=700, irt_b=1.2, imp_c=66, imp_x=70),

dict(slug="zimri_seven_days", book="1KI", chapter=16, reference="1 Kings 16:15, 18",
     dim="characters_lineage", covers=["Zimri"],
     prompt="Which king of Israel reigned seven days in Tirzah and then burned the royal palace down upon himself?",
     answer="Zimri",
     distractors=[
        D("Elah son of Baasha", "high", "the_king_he_assassinated", "same_event"),
        D("Tibni son of Ginath", "high", "his_rival_in_the_same_succession_crisis", "same_event"),
        D("Shallum son of Jabesh", "medium", "another_one_month_usurper_of_israel", "same_role")],
     explanation="Zimri reigned seven days. When Omri's troops took Tirzah, Zimri went into the citadel and burned it down over himself. Tibni contested the throne with Omri immediately afterwards.",
     difficulty=690, irt_b=1.15, imp_c=64, imp_x=70),

dict(slug="elah_killed_by_zimri", book="1KI", chapter=16, reference="1 Kings 16:9",
     dim="characters_lineage", covers=["Elah"],
     prompt="Which king of Israel was struck down by Zimri while getting drunk in the house of Arza his steward?",
     answer="Elah son of Baasha",
     distractors=[
        D("Nadab son of Jeroboam", "high", "the_previous_king_killed_in_a_coup", "same_role"),
        D("Ahab son of Omri", "high", "best_known_king_of_the_same_dynasty", "near_chronology"),
        D("Pekahiah son of Menahem", "medium", "another_king_killed_by_his_officer", "same_role")],
     explanation="Elah son of Baasha was assassinated by Zimri, commander of half his chariots, during a drinking bout at Tirzah. His death ends Baasha's house, just as Baasha had ended Jeroboam's.",
     difficulty=720, irt_b=1.3, imp_c=60, imp_x=66),

dict(slug="ahijah_twelve_pieces", book="1KI", chapter=11, reference="1 Kings 11:29-30",
     dim="characters_lineage", covers=["Ahijah"],
     prompt="Which prophet met Jeroboam on the road and tore a new cloak into twelve pieces?",
     answer="Ahijah the Shilonite",
     distractors=[
        D("Shemaiah the man of God", "high", "prophet_who_speaks_to_the_same_division", "same_event"),
        D("Iddo the seer", "medium", "another_prophet_of_jeroboams_reign", "same_role"),
        D("Jehu son of Hanani", "high", "prophet_sent_against_the_northern_kings", "same_role")],
     explanation="Ahijah the Shilonite tore his new cloak into twelve pieces and gave ten to Jeroboam, signifying the ten tribes. Shemaiah is the prophet who stops Rehoboam from fighting to recover them.",
     difficulty=660, irt_b=1.0, imp_c=70, imp_x=74),

dict(slug="benhadad_besieges_samaria", book="1KI", chapter=20, reference="1 Kings 20:1; 2 Kings 6:24",
     dim="characters_lineage", covers=["Ben-hadad"],
     prompt="Which king of Aram assembled his army with thirty-two kings and besieged Samaria?",
     answer="Ben-hadad king of Aram",
     distractors=[
        D("Hazael king of Aram", "high", "his_successor_on_the_aramean_throne", "same_role"),
        D("Rezin king of Aram", "high", "later_aramean_king_confused_for_him", "same_role"),
        D("Hadadezer king of Zobah", "medium", "earlier_aramean_king_defeated_by_david", "same_role")],
     explanation="Ben-hadad of Aram besieged Samaria with thirty-two allied kings, and besieged it again in Elisha's day. Hazael, whom Elisha anoints, succeeds him; Rezin belongs to the later Assyrian crisis.",
     difficulty=670, irt_b=1.05, imp_c=66, imp_x=70),

dict(slug="menahem_pays_pul", book="2KI", chapter=15, reference="2 Kings 15:19",
     dim="characters_lineage", covers=["Menahem", "Tiglath-pileser"],
     prompt="Which king of Israel gave a thousand talents of silver to Pul king of Assyria to secure his own grip on the kingdom?",
     answer="Menahem",
     distractors=[
        D("Pekah son of Remaliah", "high", "the_king_who_resists_assyria_instead", "near_chronology"),
        D("Hoshea son of Elah", "high", "the_king_who_later_pays_then_rebels", "near_chronology"),
        D("Pekahiah son of Menahem", "medium", "his_own_son_and_successor", "same_generation")],
     explanation="Menahem bought Assyrian support with a thousand talents of silver exacted from Israel's wealthy men. 2 Kings calls this king Pul; 1 Chronicles 5:26 identifies Pul as Tiglath-pileser king of Assyria.",
     difficulty=740, irt_b=1.4, imp_c=64, imp_x=70),

dict(slug="pekah_rezin_against_ahaz", book="2KI", chapter=16, reference="2 Kings 16:5",
     dim="characters_lineage", covers=["Pekah", "Remaliah", "Rezin"],
     prompt="Which pair of kings marched up together to besiege Jerusalem in the days of Ahaz?",
     answer="Rezin of Aram and Pekah son of Remaliah",
     distractors=[
        D("Ben-hadad of Aram and Menahem of Israel", "high", "right_kingdoms_wrong_generation", "near_chronology"),
        D("Hazael of Aram and Jehoash of Israel", "high", "right_kingdoms_earlier_generation", "near_chronology"),
        D("Tiglath-pileser of Assyria and Hoshea", "medium", "the_powers_of_the_following_decade", "near_chronology")],
     explanation="Rezin of Aram and Pekah son of Remaliah besieged Ahaz in Jerusalem but could not overcome him. This is the crisis behind Isaiah 7 and the Immanuel sign.",
     difficulty=760, irt_b=1.5, imp_c=72, imp_x=78),

dict(slug="hoshea_samaria_falls", book="2KI", chapter=17, reference="2 Kings 17:1, 6",
     dim="characters_lineage", covers=["Hoshea"],
     prompt="Which king of Israel was on the throne when Assyria captured Samaria and deported the Israelites?",
     answer="Hoshea son of Elah",
     distractors=[
        D("Pekah son of Remaliah", "high", "his_predecessor_on_the_throne", "near_chronology"),
        D("Menahem of Israel", "high", "earlier_king_of_the_assyrian_crisis", "near_chronology"),
        D("Pekahiah son of Menahem", "medium", "the_short_reigning_king_before_pekah", "same_role")],
     explanation="Samaria fell in the ninth year of Hoshea son of Elah, the last king of Israel. Menahem and Pekahiah belong to the same Assyrian crisis a generation earlier.",
     difficulty=680, irt_b=1.1, imp_c=74, imp_x=80),

dict(slug="rabshakeh_speaks_hebrew", book="2KI", chapter=18, reference="2 Kings 18:17, 28",
     dim="characters_lineage", covers=["Rabshakeh"],
     prompt="Which Assyrian officer stood and called out loudly in Hebrew to the people on Jerusalem's wall?",
     answer="the Rabshakeh",
     distractors=[
        D("the Tartan", "high", "sent_from_lachish_in_the_same_verse", "same_event"),
        D("the Rabsaris", "high", "sent_from_lachish_in_the_same_verse", "same_event"),
        D("Nebuzaradan", "medium", "babylonian_officer_at_the_later_siege", "same_role")],
     explanation="Sennacherib sent three officers from Lachish, but it is the Rabshakeh who addresses Hezekiah's men and then shouts to the people in Hebrew over the heads of their officials.",
     difficulty=770, irt_b=1.55, imp_c=62, imp_x=70),

dict(slug="neco_kills_josiah", book="2KI", chapter=23, reference="2 Kings 23:29",
     dim="characters_lineage", covers=["Neco"],
     prompt="Which pharaoh marched to the Euphrates to help Assyria and killed Josiah at Megiddo?",
     answer="Pharaoh Neco",
     distractors=[
        D("Pharaoh Hophra", "high", "the_pharaoh_of_the_next_generation", "near_chronology"),
        D("Pharaoh Shishak", "high", "the_pharaoh_who_plundered_the_temple", "same_role"),
        D("So king of Egypt", "medium", "pharaoh_hoshea_appealed_to", "same_role")],
     explanation="Josiah went out to confront Pharaoh Neco at Megiddo and was killed there. Shishak had plundered the temple in Rehoboam's day; Hophra is the pharaoh Jeremiah later denounces.",
     difficulty=700, irt_b=1.2, imp_c=70, imp_x=76),

dict(slug="nebuzaradan_burns_temple", book="2KI", chapter=25, reference="2 Kings 25:8-9",
     dim="characters_lineage", covers=["Nebuzaradan"],
     prompt="Which Babylonian captain of the guard entered Jerusalem and burned down the house of the LORD?",
     answer="Nebuzaradan",
     distractors=[
        D("Nebuchadnezzar", "high", "the_king_who_sent_him", "same_event"),
        D("Nergal-sharezer", "high", "another_named_babylonian_officer", "same_role"),
        D("Ashpenaz", "medium", "the_official_who_took_the_exiles", "same_role")],
     explanation="Nebuzaradan, captain of the guard, came to Jerusalem in Nebuchadnezzar's nineteenth year and burned the temple, the palace, and every significant building. The king himself was not present.",
     difficulty=690, irt_b=1.15, imp_c=70, imp_x=76),

dict(slug="queen_of_sheba_tests", book="1KI", chapter=10, reference="1 Kings 10:1",
     dim="characters_lineage", covers=["Queen of Sheba"],
     prompt="Who heard of Solomon's fame and came to test him with difficult questions?",
     answer="the queen of Sheba",
     distractors=[
        D("Hiram king of Tyre", "high", "the_other_foreign_ruler_who_visits", "same_book"),
        D("the daughter of Pharaoh", "high", "solomons_best_known_foreign_royal_tie", "same_book"),
        D("the queen mother Bathsheba", "medium", "the_queen_of_solomons_own_court", "same_book")],
     explanation="The queen of Sheba came to Jerusalem with a great caravan to test Solomon with hard questions, and found that not even half had been told her.",
     difficulty=520, irt_b=0.4, imp_c=74, imp_x=80),

dict(slug="hiram_tyre_cedar", book="1KI", chapter=5, reference="1 Kings 5:1",
     dim="characters_lineage", covers=["Hiram"],
     prompt="Which king sent envoys to Solomon on his accession, having always been a friend of David?",
     answer="Hiram king of Tyre",
     distractors=[
        D("Toi king of Hamath", "high", "another_king_friendly_to_david", "same_role"),
        D("Hadadezer king of Zobah", "high", "aramean_king_of_davids_wars", "same_role"),
        D("Ben-hadad king of Aram", "medium", "best_known_aramean_royal_name", "same_role")],
     explanation="Hiram of Tyre, a lifelong friend of David, sent envoys when Solomon was anointed, and supplied cedar and cypress for the temple in exchange for wheat and oil.",
     difficulty=610, irt_b=0.85, imp_c=68, imp_x=74),

# ------------------------------------------------------------- Jeremiah's world
dict(slug="ahikam_shields_jeremiah", book="JER", chapter=26, reference="Jeremiah 26:24",
     dim="characters_lineage", covers=["Ahikam"],
     prompt="Whose support kept Jeremiah from being handed over to the people to be put to death?",
     answer="Ahikam son of Shaphan",
     distractors=[
        D("Gemariah son of Shaphan", "high", "his_brother_who_also_aids_jeremiah", "same_generation"),
        D("Ebed-melech the Cushite", "high", "the_man_who_lifts_jeremiah_from_the_cistern", "same_book"),
        D("Baruch son of Neriah", "medium", "jeremiahs_scribe_and_closest_ally", "same_book")],
     explanation="Ahikam son of Shaphan stood behind Jeremiah at the trial after the temple sermon. Ebed-melech rescues him later from the cistern; Baruch is his scribe, not his protector in court.",
     difficulty=750, irt_b=1.45, imp_c=62, imp_x=68),

dict(slug="ishmael_kills_gedaliah", book="JER", chapter=41, reference="Jeremiah 41:1-2",
     dim="characters_lineage", covers=["Nethaniah", "Johanan", "Kareah"],
     prompt="Who came with ten men to Mizpah, ate a meal with Gedaliah, and then struck him down with the sword?",
     answer="Ishmael son of Nethaniah",
     distractors=[
        D("Johanan son of Kareah", "high", "the_commander_who_avenges_gedaliah", "same_event"),
        D("Nebuzaradan captain of the guard", "high", "the_babylonian_who_installed_gedaliah", "same_event"),
        D("Seraiah son of Neriah", "medium", "another_named_official_of_the_period", "same_book")],
     explanation="Ishmael son of Nethaniah, of the royal family, murdered Gedaliah the governor at Mizpah. Johanan son of Kareah heard of the crime and pursued him, then led the survivors down to Egypt.",
     difficulty=780, irt_b=1.6, imp_c=64, imp_x=72),

dict(slug="hophra_handed_over", book="JER", chapter=44, reference="Jeremiah 44:30",
     dim="promise_prophecy", covers=["Hophra"],
     prompt="Which pharaoh did the LORD promise to hand over to his enemies, as Zedekiah had been handed to Nebuchadnezzar?",
     answer="Pharaoh Hophra",
     distractors=[
        D("Pharaoh Neco", "high", "the_pharaoh_of_the_previous_generation", "near_chronology"),
        D("Pharaoh Shishak", "high", "the_pharaoh_who_plundered_the_temple", "same_role"),
        D("Tirhakah king of Cush", "medium", "the_cushite_king_who_faced_assyria", "same_role")],
     explanation="Jeremiah's word against the Judeans in Egypt names Pharaoh Hophra as the sign: he will fall to those who seek his life, exactly as Zedekiah fell to Nebuchadnezzar.",
     difficulty=790, irt_b=1.65, imp_c=60, imp_x=66),

# ------------------------------------------------------------------- Torah / Judges
dict(slug="og_bashan_iron_bed", book="DEU", chapter=3, reference="Deuteronomy 3:11",
     dim="characters_lineage", covers=["Og"],
     prompt="Which king was the last remnant of the Rephaim, his iron bed still kept at Rabbah of the Ammonites?",
     answer="Og king of Bashan",
     distractors=[
        D("Sihon king of Heshbon", "high", "defeated_in_the_same_campaign", "same_event"),
        D("Balak king of Moab", "high", "the_next_king_israel_encounters", "near_chronology"),
        D("Jabin of Hazor", "medium", "another_canaanite_king_israel_defeats", "same_role")],
     explanation="Deuteronomy pauses to note that only Og of Bashan remained of the Rephaim, and that his iron bedstead was still on display in Rabbah. Sihon is defeated just before him.",
     difficulty=640, irt_b=0.95, imp_c=70, imp_x=74),

dict(slug="hur_holds_moses_hands", book="EXO", chapter=17, reference="Exodus 17:12",
     dim="characters_lineage", covers=["Hur"],
     prompt="Who held up one of Moses' hands, with Aaron holding the other, during the battle against Amalek?",
     answer="Hur",
     distractors=[
        D("Joshua son of Nun", "high", "the_man_fighting_in_the_valley_below", "same_event"),
        D("Caleb son of Jephunneh", "high", "joshuas_usual_companion", "same_generation"),
        D("Eleazar son of Aaron", "medium", "aarons_son_assumed_to_assist", "same_generation")],
     explanation="Aaron and Hur put a stone under Moses and held up his hands, one on each side, until sunset. Joshua was leading the fighting below, not steadying Moses' arms.",
     difficulty=590, irt_b=0.75, imp_c=70, imp_x=76),

dict(slug="ephron_sells_cave", book="GEN", chapter=23, reference="Genesis 23:16",
     dim="characters_lineage", covers=["Ephron"],
     prompt="From whom did Abraham buy a burial site, weighing out four hundred shekels of silver?",
     answer="Ephron the Hittite",
     distractors=[
        D("Abimelech king of Gerar", "high", "the_other_man_abraham_makes_a_pact_with", "same_book"),
        D("Mamre the Amorite", "high", "the_place_name_treated_as_the_seller", "same_location"),
        D("Melchizedek king of Salem", "medium", "another_canaanite_figure_abraham_deals_with", "same_book")],
     explanation="Abraham weighed out four hundred shekels to Ephron the Hittite for the field of Machpelah with its cave, the first piece of the land Abraham actually owned.",
     difficulty=620, irt_b=0.85, imp_c=72, imp_x=76),

dict(slug="manoah_father_of_samson", book="JDG", chapter=13, reference="Judges 13:2",
     dim="characters_lineage", covers=["Manoah"],
     prompt="Which Danite from Zorah, whose wife was barren, became the father of Samson?",
     answer="Manoah",
     distractors=[
        D("Jephthah the Gileadite", "high", "the_judge_immediately_before_samson", "near_chronology"),
        D("Elkanah the Ephraimite", "high", "father_of_a_child_given_to_a_barren_wife", "same_theme"),
        D("Kish the Benjamite", "medium", "father_of_another_famous_deliverer", "same_role")],
     explanation="Manoah of Zorah, of the clan of the Danites, had a barren wife to whom the angel of the LORD announced Samson's birth. Elkanah is Samuel's father, a different barren-wife story.",
     difficulty=630, irt_b=0.9, imp_c=68, imp_x=72),

dict(slug="zebah_zalmunna_kings", book="JDG", chapter=8, reference="Judges 8:12",
     dim="characters_lineage", covers=["Zebah", "Zalmunna"],
     prompt="Which two kings of Midian did Gideon pursue and capture, routing their entire army?",
     answer="Zebah and Zalmunna",
     distractors=[
        D("Oreb and Zeeb", "high", "the_midianite_princes_taken_earlier", "same_event"),
        D("Sihon and Og", "high", "the_two_kings_of_the_transjordan", "same_role"),
        D("Jabin and Sisera", "medium", "the_enemy_pair_of_the_previous_cycle", "same_role")],
     explanation="Judges distinguishes two pairs: Oreb and Zeeb, the princes killed at the rock and the winepress, and Zebah and Zalmunna, the two kings Gideon pursued across the Jordan and captured.",
     difficulty=680, irt_b=1.1, imp_c=66, imp_x=72),

dict(slug="oreb_zeeb_princes", book="JDG", chapter=7, reference="Judges 7:25",
     dim="characters_lineage", covers=["Oreb", "Zeeb"],
     prompt="Which two princes of Midian were killed at a rock and a winepress that were then named after them?",
     answer="Oreb and Zeeb",
     distractors=[
        D("Zebah and Zalmunna", "high", "the_midianite_kings_taken_later", "same_event"),
        D("Gaal and Zebul", "high", "the_rival_pair_of_the_next_chapter", "same_book"),
        D("Jabin and Sisera", "medium", "the_enemy_pair_of_the_previous_cycle", "same_role")],
     explanation="The Ephraimites killed Oreb at the rock of Oreb and Zeeb at the winepress of Zeeb, and brought their heads to Gideon. The kings Zebah and Zalmunna are captured afterwards.",
     difficulty=700, irt_b=1.2, imp_c=64, imp_x=70),

dict(slug="bilhah_mother_of_dan", book="GEN", chapter=30, reference="Genesis 30:5-8",
     dim="characters_lineage", covers=["Bilhah"],
     prompt="Which servant bore Jacob the sons Rachel named Dan and Naphtali?",
     answer="Bilhah, Rachel's servant",
     distractors=[
        D("Zilpah, Leah's servant", "high", "the_other_servant_who_bears_sons", "same_generation"),
        D("Leah, Jacob's first wife", "high", "the_wife_with_the_most_sons", "same_generation"),
        D("Rachel, Jacob's second wife", "medium", "the_woman_who_names_the_sons", "same_event")],
     explanation="Rachel gave her servant Bilhah to Jacob, and Rachel named the two sons Bilhah bore: Dan and Naphtali. Leah's servant Zilpah bears Gad and Asher.",
     difficulty=660, irt_b=1.0, imp_c=68, imp_x=72),

dict(slug="chedorlaomer_twelve_years", book="GEN", chapter=14, reference="Genesis 14:1, 4",
     dim="characters_lineage", covers=["Chedorlaomer", "Arioch"],
     prompt="The cities of the plain had been subject twelve years to which king before they rebelled?",
     answer="Chedorlaomer of Elam",
     distractors=[
        D("Amraphel of Shinar", "high", "listed_first_among_the_four_kings", "same_event"),
        D("Arioch of Ellasar", "high", "another_of_the_four_allied_kings", "same_event"),
        D("Tidal of Goiim", "medium", "the_fourth_of_the_allied_kings", "same_event")],
     explanation="Four kings march together, but Genesis says the cities of the plain had served Chedorlaomer of Elam for twelve years. He is the overlord; the others are his allies.",
     difficulty=740, irt_b=1.4, imp_c=62, imp_x=68),

dict(slug="anak_three_sons_hebron", book="JOS", chapter=15, reference="Joshua 15:14; 14:15",
     dim="characters_lineage", covers=["Anak"],
     prompt="Sheshai, Ahiman, and Talmai, whom Caleb drove out of Hebron, were the descendants of which man?",
     answer="Anak",
     distractors=[
        D("Arba", "high", "the_man_hebron_was_named_after", "same_location"),
        D("Og", "high", "the_other_giant_king_of_the_conquest", "same_role"),
        D("Sihon", "medium", "og_s_companion_king_in_the_conquest", "same_role")],
     explanation="Caleb drove the three sons of Anak out of Hebron. Arba, after whom Hebron was called Kiriath-arba, is described as the greatest man among the Anakim, but the three are Anak's sons.",
     difficulty=720, irt_b=1.3, imp_c=62, imp_x=68),

dict(slug="heber_kenite_jael", book="JDG", chapter=4, reference="Judges 4:17",
     dim="characters_lineage", covers=["Heber"],
     prompt="Jael, who killed Sisera in her tent, was the wife of which man?",
     answer="Heber the Kenite",
     distractors=[
        D("Lappidoth", "high", "deborahs_husband_confused_for_jaels", "same_event"),
        D("Barak son of Abinoam", "high", "the_commander_in_the_same_story", "same_event"),
        D("Hobab the Midianite", "medium", "another_kenite_associated_with_israel", "same_role")],
     explanation="Sisera fled to the tent of Jael, wife of Heber the Kenite, because Heber's house was at peace with Jabin. Lappidoth is Deborah's husband, which is the standard confusion here.",
     difficulty=690, irt_b=1.15, imp_c=64, imp_x=70),

dict(slug="balak_son_of_zippor", book="NUM", chapter=22, reference="Numbers 22:4",
     dim="characters_lineage", covers=["Zippor"],
     prompt="Balak, the king of Moab who sent for Balaam, is identified in Numbers as the son of whom?",
     answer="Zippor",
     distractors=[
        D("Eglon", "high", "the_other_named_king_of_moab", "same_role"),
        D("Beor", "high", "balaams_father_swapped_for_balaks", "same_event"),
        D("Zohar", "medium", "similar_sounding_patriarchal_name", "same_generation")],
     explanation="Numbers repeatedly calls him Balak son of Zippor, king of Moab. Beor is the father of Balaam, the prophet Balak hires, which makes it the easiest name to swap in.",
     difficulty=770, irt_b=1.55, imp_c=58, imp_x=64),

# --------------------------------------------------------------------- New Testament
dict(slug="andrew_finds_simon", book="JHN", chapter=1, reference="John 1:40-41",
     dim="characters_lineage", covers=["Andrew"],
     prompt="Which disciple first went and found his own brother Simon, saying \"We have found the Messiah\"?",
     answer="Andrew",
     distractors=[
        D("Philip", "high", "the_next_disciple_to_fetch_someone", "same_event"),
        D("Nathanael", "high", "the_man_philip_fetches", "same_event"),
        D("John son of Zebedee", "medium", "the_unnamed_other_disciple_present", "same_event")],
     explanation="Andrew was one of the two who heard John's testimony and followed Jesus; he then found his brother Simon. Philip goes on to find Nathanael in the same chapter.",
     difficulty=560, irt_b=0.6, imp_c=76, imp_x=80),

dict(slug="andrew_five_loaves", book="JHN", chapter=6, reference="John 6:8-9",
     dim="characters_lineage", covers=["Andrew"],
     prompt="Which disciple pointed out the boy with five barley loaves and two small fish?",
     answer="Andrew",
     distractors=[
        D("Philip of Bethsaida", "high", "the_disciple_jesus_questions_first", "same_event"),
        D("Thomas called Didymus", "high", "another_disciple_who_speaks_in_john", "same_book"),
        D("James son of Zebedee", "medium", "another_fisherman_among_the_twelve", "same_role")],
     explanation="Jesus tests Philip about buying bread, and it is Andrew who notices the boy with five barley loaves and two fish and asks what they amount to among so many.",
     difficulty=650, irt_b=1.0, imp_c=70, imp_x=74),

dict(slug="mary_magdalene_first", book="JHN", chapter=20, reference="John 20:14-16",
     dim="characters_lineage", covers=["Mary Magdalene"],
     prompt="Which woman, weeping outside the empty tomb, mistook the risen Jesus for the gardener until He spoke her name?",
     answer="Mary Magdalene",
     distractors=[
        D("Mary of Bethany", "high", "the_other_prominent_mary_in_john", "same_book"),
        D("Mary the wife of Clopas", "high", "stood_with_her_at_the_cross_in_john", "same_event"),
        D("Joanna", "medium", "another_woman_at_the_tomb_in_luke", "same_role")],
     explanation="In John's account Mary Magdalene stayed weeping outside the empty tomb and supposed Jesus to be the gardener, until He said \"Mary\" and she answered \"Rabboni.\" She then went and announced to the disciples, \"I have seen the Lord.\"",
     difficulty=540, irt_b=0.5, imp_c=80, imp_x=84),

dict(slug="cornelius_centurion", book="ACT", chapter=10, reference="Acts 10:1",
     dim="characters_lineage", covers=["Cornelius"],
     prompt="Which centurion of the Italian Regiment at Caesarea was told in a vision to send for Peter?",
     answer="Cornelius of Caesarea",
     distractors=[
        D("Julius the centurion", "high", "the_centurion_who_escorts_paul_to_rome", "same_role"),
        D("Claudius Lysias the commander", "high", "the_officer_who_rescues_paul_in_jerusalem", "same_role"),
        D("the centurion at Capernaum", "medium", "the_gospel_centurion_commended_for_faith", "same_role")],
     explanation="Cornelius, a devout centurion of the Italian Regiment stationed at Caesarea, was told to send for Peter. His household's baptism opens the gospel formally to the Gentiles.",
     difficulty=570, irt_b=0.65, imp_c=78, imp_x=82),

dict(slug="zebedee_father_james_john", book="MAT", chapter=4, reference="Matthew 4:21",
     dim="characters_lineage", covers=["Zebedee", "Alphaeus"],
     prompt="James and John were mending nets in a boat with which man, their father, when Jesus called them?",
     answer="Zebedee",
     distractors=[
        D("Alphaeus", "high", "father_of_a_different_james_among_the_twelve", "same_generation"),
        D("Jonah", "high", "father_of_simon_peter", "same_generation"),
        D("Clopas", "medium", "another_named_man_in_the_passion_narrative", "same_generation")],
     explanation="Jesus saw James son of Zebedee and his brother John in a boat with their father Zebedee, mending nets. The other James among the Twelve is the son of Alphaeus.",
     difficulty=580, irt_b=0.7, imp_c=70, imp_x=74),

dict(slug="nathanael_nazareth", book="JHN", chapter=1, reference="John 1:46-47",
     dim="characters_lineage", covers=["Nathanael"],
     prompt="Who asked \"Can anything good come from Nazareth?\" and was then called a true Israelite without deceit?",
     answer="Nathanael",
     distractors=[
        D("Philip", "high", "the_man_who_answers_come_and_see", "same_event"),
        D("Andrew", "high", "the_other_disciple_called_in_the_chapter", "same_event"),
        D("Thomas", "medium", "the_disciple_known_for_doubting", "same_book")],
     explanation="Philip told Nathanael about Jesus of Nazareth, and Nathanael answered with the question. When he came, Jesus called him a true Israelite in whom there is no deceit.",
     difficulty=600, irt_b=0.8, imp_c=70, imp_x=74),

dict(slug="priscilla_aquila_apollos", book="ACT", chapter=18, reference="Acts 18:26",
     dim="characters_lineage", covers=["Aquila"],
     prompt="Which married couple took Apollos aside and explained the way of God to him more accurately?",
     answer="Priscilla and Aquila",
     distractors=[
        D("Ananias and Sapphira", "high", "the_best_known_couple_in_acts", "same_book"),
        D("Andronicus and Junia", "high", "pair_paul_greets_not_stated_to_be_married", "same_role"),
        D("Philemon and Apphia", "medium", "pair_paul_addresses_not_stated_to_be_married", "same_role")],
     explanation="Priscilla and Aquila heard Apollos speaking boldly in the synagogue at Ephesus and took him aside to explain the way of God more accurately. They were tentmakers Paul had lodged with in Corinth.",
     difficulty=640, irt_b=0.95, imp_c=70, imp_x=74),

dict(slug="claudius_expels_jews", book="ACT", chapter=18, reference="Acts 18:2",
     dim="characters_lineage", covers=["Claudius"],
     prompt="Whose order that all Jews leave Rome had brought Aquila and Priscilla to Corinth?",
     answer="Claudius",
     distractors=[
        D("Tiberius", "high", "the_emperor_of_the_gospels", "near_chronology"),
        D("Nero", "high", "the_emperor_paul_later_appeals_to", "near_chronology"),
        D("Augustus", "medium", "the_emperor_of_the_nativity_census", "near_chronology")],
     explanation="Luke notes that Aquila had recently come from Italy with his wife Priscilla because Claudius had ordered all the Jews to leave Rome. Claudius is also the emperor of the famine Agabus foretold.",
     difficulty=690, irt_b=1.15, imp_c=64, imp_x=70),

dict(slug="herodias_john_baptist", book="MRK", chapter=6, reference="Mark 6:17, 24",
     dim="characters_lineage", covers=["Herodias"],
     prompt="Which wife of Herod, formerly married to his brother Philip, told her daughter to ask for John the Baptist's head?",
     answer="Herodias",
     distractors=[
        D("Drusilla", "high", "another_herodian_wife_named_in_acts", "same_role"),
        D("Bernice", "high", "another_herodian_woman_named_in_acts", "same_role"),
        D("Salome", "medium", "the_unnamed_daughter_confused_for_her_mother", "same_event")],
     explanation="Herod had imprisoned John on account of Herodias, his brother Philip's wife, whom he had married. When the girl asked her mother what to request, Herodias named John's head.",
     difficulty=610, irt_b=0.85, imp_c=70, imp_x=76),

dict(slug="festus_succeeds_felix", book="ACT", chapter=24, reference="Acts 24:27",
     dim="characters_lineage", covers=["Festus"],
     prompt="Who succeeded Felix as governor, inheriting Paul still in prison after two years?",
     answer="Porcius Festus",
     distractors=[
        D("Claudius Lysias", "high", "the_commander_who_sent_paul_to_felix", "same_event"),
        D("Herod Agrippa", "high", "the_king_who_hears_paul_before_festus", "same_event"),
        D("Gallio of Achaia", "medium", "the_proconsul_who_dismissed_a_case", "same_role")],
     explanation="After two years Felix was succeeded by Porcius Festus, and Felix left Paul in prison to do the Jews a favour. It is before Festus that Paul appeals to Caesar.",
     difficulty=660, irt_b=1.0, imp_c=66, imp_x=72),
]

# ------------------------------------------------------------------ order items
# OT only: the sequence UI and the __ORDER__ grading path are wired for the
# OT assessment, so these are all OT scenes.
ORDERS = [
dict(slug="absalom_flight_people", book="2SA", chapter=15,
     reference="2 Samuel 15:19; 16:1; 16:5; 17:27",
     covers=["Ittai", "Ziba", "Shimei", "Barzillai"],
     prompt="Place the men David met on his flight from Absalom in the order he met them.",
     items=[("ittai", "Ittai the Gittite refuses to turn back"),
            ("ziba", "Ziba meets David with loaded donkeys"),
            ("shimei", "Shimei comes out of Bahurim cursing"),
            ("barzillai", "Barzillai supplies the king at Mahanaim")],
     order=["ittai", "ziba", "shimei", "barzillai"],
     explanation="Ittai pledges loyalty as the column leaves Jerusalem; Ziba meets David just beyond the summit; Shimei curses him at Bahurim further on; Barzillai provisions him once he reaches Mahanaim.",
     difficulty=740, irt_b=1.4, imp_c=68, imp_x=74),

dict(slug="israel_kings_baasha_omri", book="1KI", chapter=16,
     reference="1 Kings 15:27; 16:8, 15, 23",
     covers=["Baasha", "Elah", "Zimri"],
     prompt="Place these kings of Israel in the order they came to the throne.",
     items=[("baasha", "Baasha, who struck down Nadab"),
            ("elah", "Elah, the son of Baasha"),
            ("zimri", "Zimri, who reigned seven days"),
            ("omri", "Omri, the commander of the army")],
     order=["baasha", "elah", "zimri", "omri"],
     explanation="Baasha seized the throne by killing Nadab, his son Elah followed, Zimri assassinated Elah and held Tirzah seven days, and the army then proclaimed Omri, who founded the dynasty of Ahab.",
     difficulty=760, irt_b=1.5, imp_c=66, imp_x=72),

dict(slug="northern_kingdom_end", book="2KI", chapter=17,
     reference="2 Kings 15:19, 27; 16:5; 17:1, 6",
     covers=["Menahem", "Pekah", "Remaliah", "Hoshea"],
     prompt="Place these stages in the last years of the northern kingdom in order.",
     items=[("menahem", "Menahem pays Pul of Assyria in silver"),
            ("pekah", "Pekah son of Remaliah takes the throne"),
            ("ahaz", "Pekah and Rezin besiege Ahaz in Jerusalem"),
            ("hoshea", "Hoshea reigns, and Samaria falls")],
     order=["menahem", "pekah", "ahaz", "hoshea"],
     explanation="Menahem buys Assyrian favour; Pekah son of Remaliah later seizes the throne; Pekah and Rezin then besiege Ahaz; Hoshea, the last king, is reigning when Samaria falls in his ninth year.",
     difficulty=790, irt_b=1.65, imp_c=70, imp_x=76),

dict(slug="after_jerusalem_falls", book="JER", chapter=41,
     reference="2 Kings 25:8, 22; Jeremiah 41:2, 11; 43:7",
     covers=["Nebuzaradan", "Nethaniah", "Johanan", "Kareah"],
     prompt="Place these events after the fall of Jerusalem in the order they happened.",
     items=[("burn", "Nebuzaradan burns the house of the LORD"),
            ("gedaliah", "Gedaliah is made governor over the land"),
            ("murder", "Ishmael son of Nethaniah murders Gedaliah"),
            ("egypt", "Johanan son of Kareah leads the people to Egypt")],
     order=["burn", "gedaliah", "murder", "egypt"],
     explanation="Nebuzaradan burns the temple, Babylon appoints Gedaliah over those left behind, Ishmael son of Nethaniah assassinates him at Mizpah, and Johanan son of Kareah then takes the survivors down into Egypt.",
     difficulty=800, irt_b=1.7, imp_c=66, imp_x=72),

dict(slug="gideon_midian_campaign", book="JDG", chapter=8,
     reference="Judges 7:25; 8:12, 23, 27",
     covers=["Oreb", "Zeeb", "Zebah", "Zalmunna"],
     prompt="Place these stages of Gideon's campaign against Midian in order.",
     items=[("princes", "Oreb and Zeeb are killed and their heads brought"),
            ("kings", "Zebah and Zalmunna are pursued and captured"),
            ("refuse", "Gideon refuses to rule over Israel"),
            ("ephod", "Gideon makes an ephod that becomes a snare")],
     order=["princes", "kings", "refuse", "ephod"],
     explanation="The Ephraimites take the princes Oreb and Zeeb first; Gideon then crosses the Jordan and captures the kings Zebah and Zalmunna; afterwards he refuses kingship, then makes the ephod that ensnares Israel.",
     difficulty=750, irt_b=1.45, imp_c=64, imp_x=70),
]
