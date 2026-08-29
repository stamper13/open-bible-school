// The dashboard's "Verse of the Day" — shown in the middle column of the
// score strip, which is otherwise empty breathing room once a score exists
// (see .level-block in app/page.tsx).
//
// Scope is deliberate: New Testament passages, or Old Testament passages
// the New Testament itself quotes or alludes to heavily (messianic
// prophecy, the Shema, the psalms the apostles preach from) — not a general
// "inspirational verses" grab bag.
//
// Text is the Berean Standard Bible, which its publisher has released into
// the public domain. It is not transcribed by hand: every entry below was
// extracted mechanically from the BSB USFM already in this project at
// bible-ingest/input/bsb-sfm, with footnote and cross-reference markers
// stripped. A verse lifted out of its paragraph can carry a quotation mark
// whose partner lives in the neighbouring verse, so orphaned quote marks
// were dropped and ranges were chosen to end on a complete sentence.
//
// The pool is 433 entries — more than a year, on purpose. The picker
// counts whole days since the Unix epoch rather than days into the year, so
// the rotation keeps walking past December 31 instead of resetting. That
// matters: on a day-of-year picker anything beyond entry 365 would be
// unreachable, and every calendar date would be pinned to the same verse
// for good.
//
// The picker is deterministic (epoch day mod pool size), not random, so
// "today's verse" means the same thing on every reload and every device
// for the same calendar day.
//
// Ordering is not canonical — the list is interleaved by book so the
// rotation doesn't spend two weeks walking through Romans.

export type Verse = {
  reference: string;
  text: string;
};

export const VERSES: Verse[] = [
  {
    reference: "Matthew 1:21",
    text: "She will give birth to a Son, and you are to give Him the name Jesus, because He will save His people from their sins.",
  },
  {
    reference: "Romans 1:16",
    text: "I am not ashamed of the gospel, because it is the power of God for salvation to everyone who believes, first to the Jew, then to the Greek.",
  },
  {
    reference: "Hebrews 1:1-2",
    text: "On many past occasions and in many different ways, God spoke to our fathers through the prophets. But in these last days He has spoken to us by His Son, whom He appointed heir of all things, and through whom He made the universe.",
  },
  {
    reference: "Revelation 1:8",
    text: "“I am the Alpha and the Omega,” says the Lord God, who is and was and is to come—the Almighty.",
  },
  {
    reference: "Psalm 1:1-2",
    text: "Blessed is the man who does not walk in the counsel of the wicked, or set foot on the path of sinners, or sit in the seat of mockers. But his delight is in the Law of the LORD, and on His law he meditates day and night.",
  },
  {
    reference: "Luke 1:37",
    text: "For no word from God will ever fail.",
  },
  {
    reference: "John 1:1",
    text: "In the beginning was the Word, and the Word was with God, and the Word was God.",
  },
  {
    reference: "Philippians 1:6",
    text: "being confident of this, that He who began a good work in you will carry it on to completion until the day of Christ Jesus.",
  },
  {
    reference: "2 Corinthians 1:3-4",
    text: "Blessed be the God and Father of our Lord Jesus Christ, the Father of compassion and the God of all comfort, who comforts us in all our troubles, so that we can comfort those in any trouble with the comfort we ourselves have received from God.",
  },
  {
    reference: "Romans 1:17",
    text: "For the gospel reveals the righteousness of God that comes by faith from start to finish, just as it is written: “The righteous will live by faith.”",
  },
  {
    reference: "Matthew 3:17",
    text: "And a voice from heaven said, “This is My beloved Son, in whom I am well pleased!”",
  },
  {
    reference: "1 Corinthians 1:18",
    text: "For the message of the cross is foolishness to those who are perishing, but to us who are being saved it is the power of God.",
  },
  {
    reference: "Psalm 8:3-4",
    text: "When I behold Your heavens, the work of Your fingers, the moon and the stars, which You have set in place— what is man that You are mindful of him, or the son of man that You care for him?",
  },
  {
    reference: "1 Peter 1:23",
    text: "For you have been born again, not of perishable seed, but of imperishable, through the living and enduring word of God.",
  },
  {
    reference: "Isaiah 1:18",
    text: "Come now, let us reason together,” says the LORD. “Though your sins are like scarlet, they will be as white as snow; though they are as red as crimson, they will become like wool.",
  },
  {
    reference: "Acts 1:8",
    text: "But you will receive power when the Holy Spirit comes upon you, and you will be My witnesses in Jerusalem, and in all Judea and Samaria, and to the ends of the earth.",
  },
  {
    reference: "Ephesians 1:3",
    text: "Blessed be the God and Father of our Lord Jesus Christ, who has blessed us in Christ with every spiritual blessing in the heavenly realms.",
  },
  {
    reference: "John 1:3",
    text: "Through Him all things were made, and without Him nothing was made that has been made.",
  },
  {
    reference: "Hebrews 1:3",
    text: "The Son is the radiance of God’s glory and the exact representation of His nature, upholding all things by His powerful word. After He had provided purification for sins, He sat down at the right hand of the Majesty on high.",
  },
  {
    reference: "Luke 1:46-47",
    text: "Then Mary said: My soul magnifies the Lord, and my spirit rejoices in God my Savior!",
  },
  {
    reference: "1 John 1:5",
    text: "And this is the message we have heard from Him and announce to you: God is light, and in Him there is no darkness at all.",
  },
  {
    reference: "Psalm 16:11",
    text: "You have made known to me the path of life; You will fill me with joy in Your presence, with eternal pleasures at Your right hand.",
  },
  {
    reference: "Romans 3:23-24",
    text: "for all have sinned and fall short of the glory of God, and are justified freely by His grace through the redemption that is in Christ Jesus.",
  },
  {
    reference: "Mark 1:15",
    text: "“The time is fulfilled,” He said, “and the kingdom of God is near. Repent and believe in the gospel!”",
  },
  {
    reference: "Matthew 4:4",
    text: "But Jesus answered, “It is written: ‘Man shall not live on bread alone, but on every word that comes from the mouth of God.’”",
  },
  {
    reference: "Revelation 1:17-18",
    text: "When I saw Him, I fell at His feet like a dead man. But He placed His right hand on me and said, Do not be afraid. I am the First and the Last, the Living One. I was dead, and behold, now I am alive forever and ever! And I hold the keys of Death and of Hades.",
  },
  {
    reference: "Deuteronomy 6:4",
    text: "Hear, O Israel: The LORD our God, the LORD is One.",
  },
  {
    reference: "2 Timothy 1:7",
    text: "For God has not given us a spirit of fear, but of power, love, and self-control.",
  },
  {
    reference: "John 1:12-13",
    text: "But to all who did receive Him, to those who believed in His name, He gave the right to become children of God— children born not of blood, nor of the desire or will of man, but born of God.",
  },
  {
    reference: "James 1:2-3",
    text: "Consider it pure joy, my brothers, when you encounter trials of many kinds, because you know that the testing of your faith develops perseverance.",
  },
  {
    reference: "1 Corinthians 1:27",
    text: "But God chose the foolish things of the world to shame the wise; God chose the weak things of the world to shame the strong.",
  },
  {
    reference: "Colossians 1:15-16",
    text: "The Son is the image of the invisible God, the firstborn over all creation. For in Him all things were created, things in heaven and on earth, visible and invisible, whether thrones or dominions or rulers or authorities. All things were created through Him and for Him.",
  },
  {
    reference: "Jeremiah 1:5",
    text: "“Before I formed you in the womb I knew you, and before you were born I set you apart and appointed you as a prophet to the nations.”",
  },
  {
    reference: "Psalm 18:2",
    text: "The LORD is my rock, my fortress, and my deliverer. My God is my rock, in whom I take refuge, my shield, and the horn of my salvation, my stronghold.",
  },
  {
    reference: "2 Corinthians 3:17",
    text: "Now the Lord is the Spirit, and where the Spirit of the Lord is, there is freedom.",
  },
  {
    reference: "Proverbs 3:5-6",
    text: "Trust in the LORD with all your heart, and lean not on your own understanding; in all your ways acknowledge Him, and He will make your paths straight.",
  },
  {
    reference: "Isaiah 6:3",
    text: "And they were calling out to one another: “Holy, holy, holy is the LORD of Hosts; all the earth is full of His glory.”",
  },
  {
    reference: "Philippians 1:21",
    text: "For to me, to live is Christ, and to die is gain.",
  },
  {
    reference: "Hebrews 2:18",
    text: "Because He Himself suffered when He was tempted, He is able to help those who are being tempted.",
  },
  {
    reference: "Galatians 1:10",
    text: "Am I now seeking the approval of men, or of God? Or am I striving to please men? If I were still trying to please men, I would not be a servant of Christ.",
  },
  {
    reference: "Romans 4:20-21",
    text: "Yet he did not waver through disbelief in the promise of God, but was strengthened in his faith and gave glory to God, being fully persuaded that God was able to do what He had promised.",
  },
  {
    reference: "2 Thessalonians 2:16-17",
    text: "Now may our Lord Jesus Christ Himself and God our Father, who by grace has loved us and given us eternal comfort and good hope, encourage your hearts and strengthen you in every good word and deed.",
  },
  {
    reference: "Ephesians 1:7-8",
    text: "In Him we have redemption through His blood, the forgiveness of our trespasses, according to the riches of His grace that He lavished on us with all wisdom and understanding.",
  },
  {
    reference: "Acts 2:21",
    text: "And everyone who calls on the name of the Lord will be saved.’",
  },
  {
    reference: "1 Peter 1:6-7",
    text: "In this you greatly rejoice, though now for a little while you may have had to suffer grief in various trials so that the proven character of your faith—more precious than gold, which perishes even though refined by fire—may result in praise, glory, and honor at the revelation of Jesus Christ.",
  },
  {
    reference: "Luke 2:10-11",
    text: "But the angel said to them, Do not be afraid! For behold, I bring you good news of great joy that will be for all the people: Today in the city of David a Savior has been born to you. He is Christ the Lord!",
  },
  {
    reference: "John 1:14",
    text: "The Word became flesh and made His dwelling among us. We have seen His glory, the glory of the one and only Son from the Father, full of grace and truth.",
  },
  {
    reference: "Matthew 5:6",
    text: "Blessed are those who hunger and thirst for righteousness, for they will be filled.",
  },
  {
    reference: "Genesis 1:1",
    text: "In the beginning God created the heavens and the earth.",
  },
  {
    reference: "Psalm 19:1",
    text: "The heavens declare the glory of God; the skies proclaim the work of His hands.",
  },
  {
    reference: "Exodus 3:14",
    text: "God said to Moses, “I AM WHO I AM. This is what you are to say to the Israelites: ‘I AM has sent me to you.’”",
  },
  {
    reference: "1 Corinthians 2:9",
    text: "Rather, as it is written: “No eye has seen, no ear has heard, no heart has imagined, what God has prepared for those who love Him.”",
  },
  {
    reference: "Romans 5:1-2",
    text: "Therefore, since we have been justified through faith, we have peace with God through our Lord Jesus Christ, through whom we have gained access by faith into this grace in which we stand. And we rejoice in the hope of the glory of God.",
  },
  {
    reference: "Revelation 3:20",
    text: "Behold, I stand at the door and knock. If anyone hears My voice and opens the door, I will come in and dine with him, and he with Me.",
  },
  {
    reference: "1 John 1:7",
    text: "But if we walk in the light as He is in the light, we have fellowship with one another, and the blood of Jesus His Son cleanses us from all sin.",
  },
  {
    reference: "Psalm 19:14",
    text: "May the words of my mouth and the meditation of my heart be pleasing in Your sight, O LORD, my Rock and my Redeemer.",
  },
  {
    reference: "John 1:16",
    text: "From His fullness we have all received grace upon grace.",
  },
  {
    reference: "Isaiah 6:8",
    text: "Then I heard the voice of the Lord saying: “Whom shall I send? Who will go for Us?” And I said: “Here am I. Send me!”",
  },
  {
    reference: "Hebrews 3:13",
    text: "But exhort one another daily, as long as it is called today, so that none of you may be hardened by sin’s deceitfulness.",
  },
  {
    reference: "1 Thessalonians 2:13",
    text: "And we continually thank God because, when you received the word of God that you heard from us, you accepted it not as the word of men, but as it truly is, the word of God, which is also now at work in you who believe.",
  },
  {
    reference: "Matthew 5:8",
    text: "Blessed are the pure in heart, for they will see God.",
  },
  {
    reference: "2 Corinthians 3:18",
    text: "And we, who with unveiled faces all reflect the glory of the Lord, are being transformed into His image with intensifying glory, which comes from the Lord, who is the Spirit.",
  },
  {
    reference: "1 Timothy 1:15",
    text: "This is a trustworthy saying, worthy of full acceptance: Christ Jesus came into the world to save sinners, of whom I am the worst.",
  },
  {
    reference: "Mark 2:17",
    text: "On hearing this, Jesus told them, “It is not the healthy who need a doctor, but the sick. I have not come to call the righteous, but sinners.”",
  },
  {
    reference: "Luke 2:14",
    text: "“Glory to God in the highest, and on earth peace to men on whom His favor rests!”",
  },
  {
    reference: "James 1:5",
    text: "Now if any of you lacks wisdom, he should ask God, who gives generously to all without finding fault, and it will be given to him.",
  },
  {
    reference: "Ephesians 2:4-5",
    text: "But because of His great love for us, God, who is rich in mercy, made us alive with Christ even when we were dead in our trespasses. It is by grace you have been saved!",
  },
  {
    reference: "Psalm 22:1",
    text: "My God, my God, why have You forsaken me? Why are You so far from saving me, so far from my words of groaning?",
  },
  {
    reference: "Philippians 3:20-21",
    text: "But our citizenship is in heaven, and we eagerly await a Savior from there, the Lord Jesus Christ, who, by the power that enables Him to subject all things to Himself, will transform our lowly bodies to be like His glorious body.",
  },
  {
    reference: "Romans 5:3-4",
    text: "Not only that, but we also rejoice in our sufferings, because we know that suffering produces perseverance; perseverance, character; and character, hope.",
  },
  {
    reference: "Colossians 1:17",
    text: "He is before all things, and in Him all things hold together.",
  },
  {
    reference: "John 1:29",
    text: "The next day John saw Jesus coming toward him and said, Look, the Lamb of God, who takes away the sin of the world!",
  },
  {
    reference: "Acts 2:38",
    text: "Peter replied, Repent and be baptized, every one of you, in the name of Jesus Christ for the forgiveness of your sins, and you will receive the gift of the Holy Spirit.",
  },
  {
    reference: "1 Peter 1:8-9",
    text: "Though you have not seen Him, you love Him; and though you do not see Him now, you believe in Him and rejoice with an inexpressible and glorious joy, now that you are receiving the goal of your faith, the salvation of your souls.",
  },
  {
    reference: "1 Corinthians 3:16",
    text: "Do you not know that you yourselves are God’s temple, and that God’s Spirit dwells in you?",
  },
  {
    reference: "Galatians 2:20",
    text: "I have been crucified with Christ, and I no longer live, but Christ lives in me. The life I live in the body, I live by faith in the Son of God, who loved me and gave Himself up for me.",
  },
  {
    reference: "Matthew 5:14",
    text: "You are the light of the world. A city on a hill cannot be hidden.",
  },
  {
    reference: "Hebrews 4:12",
    text: "For the word of God is living and active. Sharper than any double-edged sword, it pierces even to dividing soul and spirit, joints and marrow. It judges the thoughts and intentions of the heart.",
  },
  {
    reference: "Psalm 23:1",
    text: "The LORD is my shepherd; I shall not want.",
  },
  {
    reference: "Isaiah 7:14",
    text: "Therefore the Lord Himself will give you a sign: Behold, the virgin will be with child and give birth to a son, and will call Him Immanuel.",
  },
  {
    reference: "Revelation 4:11",
    text: "“Worthy are You, our Lord and God, to receive glory and honor and power, for You created all things; by Your will they exist and were created.”",
  },
  {
    reference: "Romans 5:5",
    text: "And hope does not disappoint us, because God has poured out His love into our hearts through the Holy Spirit, whom He has given us.",
  },
  {
    reference: "John 3:16",
    text: "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.",
  },
  {
    reference: "Proverbs 4:23",
    text: "Guard your heart with all diligence, for from it flow springs of life.",
  },
  {
    reference: "Luke 4:18-19",
    text: "“The Spirit of the Lord is on Me, because He has anointed Me to preach good news to the poor. He has sent Me to proclaim liberty to the captives and recovery of sight to the blind, to release the oppressed, to proclaim the year of the Lord’s favor.”",
  },
  {
    reference: "2 Timothy 1:9",
    text: "He has saved us and called us to a holy calling, not because of our works, but by His own purpose and by the grace He granted us in Christ Jesus before time began.",
  },
  {
    reference: "2 Corinthians 4:6",
    text: "For God, who said, “Let light shine out of darkness,” made His light shine in our hearts to give us the light of the knowledge of the glory of God in the face of Jesus Christ.",
  },
  {
    reference: "2 Samuel 7:12-13",
    text: "And when your days are fulfilled and you rest with your fathers, I will raise up your descendant after you, who will come from your own body, and I will establish his kingdom. He will build a house for My Name, and I will establish the throne of his kingdom forever.",
  },
  {
    reference: "1 John 1:9",
    text: "If we confess our sins, He is faithful and just to forgive us our sins and to cleanse us from all unrighteousness.",
  },
  {
    reference: "Psalm 23:4",
    text: "Even though I walk through the valley of the shadow of death, I will fear no evil, for You are with me; Your rod and Your staff, they comfort me.",
  },
  {
    reference: "Jeremiah 17:7",
    text: "But blessed is the man who trusts in the LORD, whose confidence is in Him.",
  },
  {
    reference: "Ephesians 2:8-9",
    text: "For it is by grace you have been saved through faith, and this not from yourselves; it is the gift of God, not by works, so that no one can boast.",
  },
  {
    reference: "Matthew 5:16",
    text: "In the same way, let your light shine before men, that they may see your good deeds and glorify your Father in heaven.",
  },
  {
    reference: "Genesis 1:27",
    text: "So God created man in His own image; in the image of God He created him; male and female He created them.",
  },
  {
    reference: "1 Corinthians 4:2",
    text: "Now it is required of stewards that they be found faithful.",
  },
  {
    reference: "Deuteronomy 6:5",
    text: "And you shall love the LORD your God with all your heart and with all your soul and with all your strength.",
  },
  {
    reference: "John 3:17",
    text: "For God did not send His Son into the world to condemn the world, but to save the world through Him.",
  },
  {
    reference: "Romans 5:8",
    text: "But God proves His love for us in this: While we were still sinners, Christ died for us.",
  },
  {
    reference: "Hebrews 4:15",
    text: "For we do not have a high priest who is unable to sympathize with our weaknesses, but we have one who was tempted in every way that we are, yet was without sin.",
  },
  {
    reference: "Philippians 2:3-4",
    text: "Do nothing out of selfish ambition or empty pride, but in humility consider others more important than yourselves. Each of you should look not only to your own interests, but also to the interests of others.",
  },
  {
    reference: "Mark 4:39",
    text: "Then Jesus got up and rebuked the wind and the sea. “Silence!” He commanded. “Be still!” And the wind died down, and it was perfectly calm.",
  },
  {
    reference: "Acts 2:42",
    text: "They devoted themselves to the apostles’ teaching and to the fellowship, to the breaking of bread and to prayer.",
  },
  {
    reference: "Psalm 23:6",
    text: "Surely goodness and mercy will follow me all the days of my life, and I will dwell in the house of the LORD forever.",
  },
  {
    reference: "Isaiah 9:6",
    text: "For unto us a child is born, unto us a son is given, and the government will be upon His shoulders. And He will be called Wonderful Counselor, Mighty God, Everlasting Father, Prince of Peace.",
  },
  {
    reference: "James 1:12",
    text: "Blessed is the man who perseveres under trial, because when he has stood the test, he will receive the crown of life that God has promised to those who love Him.",
  },
  {
    reference: "2 Peter 1:3",
    text: "His divine power has given us everything we need for life and godliness through the knowledge of Him who called us by His own glory and excellence.",
  },
  {
    reference: "1 Peter 2:9",
    text: "But you are a chosen people, a royal priesthood, a holy nation, a people for God’s own possession, to proclaim the virtues of Him who called you out of darkness into His marvelous light.",
  },
  {
    reference: "Colossians 1:19-20",
    text: "For God was pleased to have all His fullness dwell in Him, and through Him to reconcile to Himself all things, whether things on earth or things in heaven, by making peace through the blood of His cross.",
  },
  {
    reference: "Ecclesiastes 3:11",
    text: "He has made everything beautiful in its time. He has also set eternity in the hearts of men, yet they cannot fathom the work that God has done from beginning to end.",
  },
  {
    reference: "Luke 6:31",
    text: "Do to others as you would have them do to you.",
  },
  {
    reference: "Revelation 5:9",
    text: "And they sang a new song: Worthy are You to take the scroll and open its seals, because You were slain, and by Your blood You purchased for God those from every tribe and tongue and people and nation.",
  },
  {
    reference: "John 3:30",
    text: "He must increase; I must decrease.",
  },
  {
    reference: "Matthew 5:44-45",
    text: "But I tell you, love your enemies and pray for those who persecute you, that you may be sons of your Father in heaven. He causes His sun to rise on the evil and the good, and sends rain on the righteous and the unrighteous.",
  },
  {
    reference: "Galatians 3:26-27",
    text: "You are all sons of God through faith in Christ Jesus. For all of you who were baptized into Christ have clothed yourselves with Christ.",
  },
  {
    reference: "Psalm 27:1",
    text: "The LORD is my light and my salvation— whom shall I fear? The LORD is the stronghold of my life— whom shall I dread?",
  },
  {
    reference: "Romans 6:4",
    text: "We were therefore buried with Him through baptism into death, in order that, just as Christ was raised from the dead through the glory of the Father, we too may walk in newness of life.",
  },
  {
    reference: "2 Corinthians 4:7",
    text: "Now we have this treasure in jars of clay to show that this surpassingly great power is from God and not from us.",
  },
  {
    reference: "1 Corinthians 6:19-20",
    text: "Do you not know that your body is a temple of the Holy Spirit who is in you, whom you have received from God? You are not your own; you were bought at a price. Therefore glorify God with your body.",
  },
  {
    reference: "Hebrews 4:16",
    text: "Let us then approach the throne of grace with confidence, so that we may receive mercy and find grace to help us in our time of need.",
  },
  {
    reference: "Ephesians 2:10",
    text: "For we are God’s workmanship, created in Christ Jesus to do good works, which God prepared in advance as our way of life.",
  },
  {
    reference: "1 John 2:15-16",
    text: "Do not love the world or anything in the world. If anyone loves the world, the love of the Father is not in him. For all that is in the world—the desires of the flesh, the desires of the eyes, and the pride of life—is not from the Father but from the world.",
  },
  {
    reference: "Psalm 27:4",
    text: "One thing I have asked of the LORD; this is what I desire: to dwell in the house of the LORD all the days of my life, to gaze on the beauty of the LORD and seek Him in His temple.",
  },
  {
    reference: "John 4:14",
    text: "But whoever drinks the water I give him will never thirst. Indeed, the water I give him will become in him a fount of water springing up to eternal life.",
  },
  {
    reference: "Isaiah 25:8",
    text: "He will swallow up death forever. The Lord GOD will wipe away the tears from every face and remove the disgrace of His people from the whole earth. For the LORD has spoken.",
  },
  {
    reference: "Daniel 2:20-21",
    text: "and declared: Blessed be the name of God forever and ever, for wisdom and power belong to Him. He changes the times and seasons; He removes kings and establishes them. He gives wisdom to the wise and knowledge to the discerning.",
  },
  {
    reference: "Matthew 6:9-10",
    text: "So then, this is how you should pray: ‘Our Father in heaven, hallowed be Your name. Your kingdom come, Your will be done, on earth as it is in heaven.",
  },
  {
    reference: "Luke 6:36",
    text: "Be merciful, just as your Father is merciful.",
  },
  {
    reference: "Acts 3:19-20",
    text: "Repent, then, and turn back, so that your sins may be wiped away, that times of refreshing may come from the presence of the Lord, and that He may send Jesus, the Christ, who has been appointed for you.",
  },
  {
    reference: "Romans 6:23",
    text: "For the wages of sin is death, but the gift of God is eternal life in Christ Jesus our Lord.",
  },
  {
    reference: "1 Timothy 2:5-6",
    text: "For there is one God, and there is one mediator between God and men, the man Christ Jesus, who gave Himself as a ransom for all—the testimony that was given at just the right time.",
  },
  {
    reference: "Philippians 2:5-7",
    text: "Let this mind be in you which was also in Christ Jesus: Who, existing in the form of God, did not consider equality with God something to be grasped, but emptied Himself, taking the form of a servant, being made in human likeness.",
  },
  {
    reference: "Exodus 14:14",
    text: "The LORD will fight for you; you need only to be still.",
  },
  {
    reference: "Revelation 5:12",
    text: "In a loud voice they were saying: “Worthy is the Lamb who was slain, to receive power and riches and wisdom and strength and honor and glory and blessing!”",
  },
  {
    reference: "Psalm 32:1-2",
    text: "Blessed is he whose transgressions are forgiven, whose sins are covered. Blessed is the man whose iniquity the LORD does not count against him, in whose spirit there is no deceit.",
  },
  {
    reference: "Proverbs 9:10",
    text: "The fear of the LORD is the beginning of wisdom, and knowledge of the Holy One is understanding.",
  },
  {
    reference: "1 Peter 2:21-22",
    text: "For to this you were called, because Christ also suffered for you, leaving you an example, that you should follow in His footsteps: “He committed no sin, and no deceit was found in His mouth.”",
  },
  {
    reference: "Mark 8:36",
    text: "What does it profit a man to gain the whole world, yet forfeit his soul?",
  },
  {
    reference: "Job 19:25",
    text: "But I know that my Redeemer lives, and in the end He will stand upon the earth.",
  },
  {
    reference: "John 4:24",
    text: "God is Spirit, and His worshipers must worship Him in spirit and in truth.",
  },
  {
    reference: "1 Corinthians 9:24",
    text: "Do you not know that in a race all the runners run, but only one receives the prize? Run in such a way as to take the prize.",
  },
  {
    reference: "Hebrews 6:19-20",
    text: "We have this hope as an anchor for the soul, firm and secure. It enters the inner sanctuary behind the curtain, where Jesus our forerunner has entered on our behalf. He has become a high priest forever in the order of Melchizedek.",
  },
  {
    reference: "1 Thessalonians 4:17",
    text: "After that, we who are alive and remain will be caught up together with them in the clouds to meet the Lord in the air. And so we will always be with the Lord.",
  },
  {
    reference: "2 Thessalonians 3:3",
    text: "But the Lord is faithful, and He will strengthen you and guard you from the evil one.",
  },
  {
    reference: "James 1:17",
    text: "Every good and perfect gift is from above, coming down from the Father of the heavenly lights, with whom there is no change or shifting shadow.",
  },
  {
    reference: "2 Corinthians 4:16",
    text: "Therefore we do not lose heart. Though our outer self is wasting away, yet our inner self is being renewed day by day.",
  },
  {
    reference: "Colossians 2:6-7",
    text: "Therefore, just as you have received Christ Jesus as Lord, continue to walk in Him, rooted and built up in Him, established in the faith as you were taught, and overflowing with thankfulness.",
  },
  {
    reference: "Micah 5:2",
    text: "But you, Bethlehem Ephrathah, who are small among the clans of Judah, out of you will come forth for Me One to be ruler over Israel — One whose origins are of old, from the days of eternity.",
  },
  {
    reference: "Romans 8:1",
    text: "Therefore, there is now no condemnation for those who are in Christ Jesus.",
  },
  {
    reference: "2 Timothy 2:1-2",
    text: "You therefore, my child, be strong in the grace that is in Christ Jesus. And the things that you have heard me say among many witnesses, entrust these to faithful men who will be qualified to teach others as well.",
  },
  {
    reference: "Matthew 6:19-20",
    text: "Do not store up for yourselves treasures on earth, where moth and rust destroy, and where thieves break in and steal. But store up for yourselves treasures in heaven, where moth and rust do not destroy, and where thieves do not break in and steal.",
  },
  {
    reference: "Genesis 2:24",
    text: "For this reason a man will leave his father and mother and be united to his wife, and they will become one flesh.",
  },
  {
    reference: "Psalm 34:8",
    text: "Taste and see that the LORD is good; blessed is the man who takes refuge in Him!",
  },
  {
    reference: "Isaiah 26:3",
    text: "You will keep in perfect peace the steadfast of mind, because he trusts in You.",
  },
  {
    reference: "Galatians 3:28",
    text: "There is neither Jew nor Greek, slave nor free, male nor female, for you are all one in Christ Jesus.",
  },
  {
    reference: "Ephesians 2:19-20",
    text: "Therefore you are no longer strangers and foreigners, but fellow citizens with the saints and members of God’s household, built on the foundation of the apostles and prophets, with Christ Jesus Himself as the cornerstone.",
  },
  {
    reference: "Jeremiah 17:8",
    text: "He is like a tree planted by the waters that sends out its roots toward the stream. It does not fear when the heat comes, and its leaves are always green. It does not worry in a year of drought, nor does it cease to produce fruit.",
  },
  {
    reference: "Luke 6:38",
    text: "Give, and it will be given to you. A good measure, pressed down, shaken together, and running over will be poured into your lap. For with the measure you use, it will be measured back to you.",
  },
  {
    reference: "John 6:35",
    text: "Jesus answered, I am the bread of life. Whoever comes to Me will never hunger, and whoever believes in Me will never thirst.",
  },
  {
    reference: "1 John 3:1",
    text: "Behold what manner of love the Father has given to us, that we should be called children of God. And that is what we are! The reason the world does not know us is that it did not know Him.",
  },
  {
    reference: "Acts 4:12",
    text: "Salvation exists in no one else, for there is no other name under heaven given to men by which we must be saved.",
  },
  {
    reference: "Psalm 34:18",
    text: "The LORD is near to the brokenhearted; He saves the contrite in spirit.",
  },
  {
    reference: "Romans 8:11",
    text: "And if the Spirit of Him who raised Jesus from the dead is living in you, He who raised Christ Jesus from the dead will also give life to your mortal bodies through His Spirit, who lives in you.",
  },
  {
    reference: "Hebrews 7:25",
    text: "Therefore He is able to save completely those who draw near to God through Him, since He always lives to intercede for them.",
  },
  {
    reference: "1 Corinthians 10:13",
    text: "No temptation has seized you except what is common to man. And God is faithful; He will not let you be tempted beyond what you can bear. But when you are tempted, He will also provide an escape, so that you can stand up under it.",
  },
  {
    reference: "Malachi 3:6",
    text: "Because I, the LORD, do not change, you descendants of Jacob have not been destroyed.",
  },
  {
    reference: "Philippians 2:9-11",
    text: "Therefore God exalted Him to the highest place and gave Him the name above all names, that at the name of Jesus every knee should bow, in heaven and on earth and under the earth, and every tongue confess that Jesus Christ is Lord, to the glory of God the Father.",
  },
  {
    reference: "Matthew 6:24",
    text: "No one can serve two masters: Either he will hate the one and love the other, or he will be devoted to the one and despise the other. You cannot serve both God and money.",
  },
  {
    reference: "Revelation 7:17",
    text: "For the Lamb in the center of the throne will be their shepherd. ‘He will lead them to springs of living water,’ and ‘God will wipe away every tear from their eyes.’",
  },
  {
    reference: "Deuteronomy 8:3",
    text: "He humbled you, and in your hunger He gave you manna to eat, which neither you nor your fathers had known, so that you might understand that man does not live on bread alone, but on every word that comes from the mouth of the LORD.",
  },
  {
    reference: "John 8:12",
    text: "Once again, Jesus spoke to the people and said, “I am the light of the world. Whoever follows Me will never walk in the darkness, but will have the light of life.”",
  },
  {
    reference: "1 Peter 2:24",
    text: "He Himself bore our sins in His body on the tree, so that we might die to sin and live to righteousness. “By His stripes you are healed.”",
  },
  {
    reference: "Psalm 37:4",
    text: "Delight yourself in the LORD, and He will give you the desires of your heart.",
  },
  {
    reference: "2 Corinthians 4:17-18",
    text: "For our light and momentary affliction is producing for us an eternal weight of glory that is far beyond comparison. So we fix our eyes not on what is seen, but on what is unseen. For what is seen is temporary, but what is unseen is eternal.",
  },
  {
    reference: "Isaiah 30:21",
    text: "And whether you turn to the right or to the left, your ears will hear this command behind you: “This is the way. Walk in it.”",
  },
  {
    reference: "Luke 9:23",
    text: "Then Jesus said to all of them, If anyone wants to come after Me, he must deny himself and take up his cross daily and follow Me.",
  },
  {
    reference: "Titus 2:11-13",
    text: "For the grace of God has appeared, bringing salvation to everyone. It instructs us to renounce ungodliness and worldly passions, and to live sensible, upright, and godly lives in the present age, as we await the blessed hope and glorious appearance of our great God and Savior Jesus Christ.",
  },
  {
    reference: "Joel 2:28",
    text: "And afterward, I will pour out My Spirit on all people. Your sons and daughters will prophesy, your old men will dream dreams, your young men will see visions.",
  },
  {
    reference: "Mark 9:23",
    text: "“If You can?” echoed Jesus. “All things are possible to him who believes!”",
  },
  {
    reference: "Romans 8:14",
    text: "For all who are led by the Spirit of God are sons of God.",
  },
  {
    reference: "Ephesians 3:18-19",
    text: "will have power, together with all the saints, to comprehend the length and width and height and depth of the love of Christ, and to know this love that surpasses knowledge, that you may be filled with all the fullness of God.",
  },
  {
    reference: "James 1:19-20",
    text: "My beloved brothers, understand this: Everyone should be quick to listen, slow to speak, and slow to anger, for man’s anger does not bring about the righteousness that God desires.",
  },
  {
    reference: "John 8:31-32",
    text: "So He said to the Jews who had believed Him, “If you continue in My word, you are truly My disciples. Then you will know the truth, and the truth will set you free.”",
  },
  {
    reference: "Matthew 6:33",
    text: "But seek first the kingdom of God and His righteousness, and all these things will be added unto you.",
  },
  {
    reference: "Hebrews 9:27-28",
    text: "Just as man is appointed to die once, and after that to face judgment, so also Christ was offered once to bear the sins of many; and He will appear a second time, not to bear sin, but to bring salvation to those who eagerly await Him.",
  },
  {
    reference: "Colossians 2:9-10",
    text: "For in Christ all the fullness of the Deity dwells in bodily form. And you have been made complete in Christ, who is the head over every ruler and authority.",
  },
  {
    reference: "Psalm 40:8",
    text: "I delight to do Your will, O my God; Your law is within my heart.",
  },
  {
    reference: "1 Corinthians 10:31",
    text: "So whether you eat or drink or whatever you do, do it all to the glory of God.",
  },
  {
    reference: "Galatians 4:4-5",
    text: "But when the time had fully come, God sent His Son, born of a woman, born under the law, to redeem those under the law, that we might receive our adoption as sons.",
  },
  {
    reference: "2 Peter 1:4",
    text: "Through these He has given us His precious and magnificent promises, so that through them you may become partakers of the divine nature, now that you have escaped the corruption in the world caused by evil desires.",
  },
  {
    reference: "Acts 4:20",
    text: "For we cannot stop speaking about what we have seen and heard.",
  },
  {
    reference: "Proverbs 11:2",
    text: "When pride comes, disgrace follows, but with humility comes wisdom.",
  },
  {
    reference: "Romans 8:15",
    text: "For you did not receive a spirit of slavery that returns you to fear, but you received the Spirit of adoption to sonship, by whom we cry, “Abba! Father!”",
  },
  {
    reference: "Revelation 12:11",
    text: "They have conquered him by the blood of the Lamb and by the word of their testimony. And they did not love their lives so as to shy away from death.",
  },
  {
    reference: "1 John 3:16",
    text: "By this we know what love is: Jesus laid down His life for us, and we ought to lay down our lives for our brothers.",
  },
  {
    reference: "Psalm 46:1",
    text: "God is our refuge and strength, an ever-present help in times of trouble.",
  },
  {
    reference: "John 10:10",
    text: "The thief comes only to steal and kill and destroy. I have come that they may have life, and have it in all its fullness.",
  },
  {
    reference: "Isaiah 40:8",
    text: "The grass withers and the flowers fall, but the word of our God stands forever.",
  },
  {
    reference: "Luke 10:27",
    text: "He answered, “‘Love the Lord your God with all your heart and with all your soul and with all your strength and with all your mind’ and ‘Love your neighbor as yourself.’”",
  },
  {
    reference: "Philippians 2:13",
    text: "For it is God who works in you to will and to act on behalf of His good purpose.",
  },
  {
    reference: "Matthew 7:7",
    text: "Ask, and it will be given to you; seek, and you will find; knock, and the door will be opened to you.",
  },
  {
    reference: "2 Corinthians 5:7",
    text: "For we walk by faith, not by sight.",
  },
  {
    reference: "Genesis 3:15",
    text: "And I will put enmity between you and the woman, and between your seed and her seed. He will crush your head, and you will strike his heel.",
  },
  {
    reference: "1 Timothy 4:12",
    text: "Let no one despise your youth, but set an example for the believers in speech, in conduct, in love, in faith, in purity.",
  },
  {
    reference: "1 Peter 3:15-16",
    text: "But in your hearts sanctify Christ as Lord. Always be prepared to give a defense to everyone who asks you the reason for the hope that is in you. But respond with gentleness and respect, keeping a clear conscience, so that those who slander you may be put to shame by your good behavior in Christ.",
  },
  {
    reference: "Hebrews 10:23",
    text: "Let us hold resolutely to the hope we profess, for He who promised is faithful.",
  },
  {
    reference: "1 Corinthians 12:12",
    text: "The body is a unit, though it is composed of many parts. And although its parts are many, they all form one body. So it is with Christ.",
  },
  {
    reference: "Ephesians 3:20-21",
    text: "Now to Him who is able to do immeasurably more than all we ask or imagine, according to His power that is at work within us, to Him be the glory in the church and in Christ Jesus throughout all generations, forever and ever. Amen.",
  },
  {
    reference: "Psalm 46:10",
    text: "“Be still and know that I am God; I will be exalted among the nations, I will be exalted over the earth.”",
  },
  {
    reference: "2 Timothy 2:13",
    text: "if we are faithless, He remains faithful, for He cannot deny Himself.",
  },
  {
    reference: "Romans 8:18",
    text: "I consider that our present sufferings are not comparable to the glory that will be revealed in us.",
  },
  {
    reference: "John 10:11",
    text: "I am the good shepherd. The good shepherd lays down His life for the sheep.",
  },
  {
    reference: "Amos 5:24",
    text: "But let justice roll on like a river, and righteousness like an ever-flowing stream.",
  },
  {
    reference: "Jeremiah 29:11",
    text: "For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, to give you a future and a hope.",
  },
  {
    reference: "Mark 9:35",
    text: "Sitting down, Jesus called the Twelve and said, “If anyone wants to be first, he must be the last of all and the servant of all.”",
  },
  {
    reference: "Exodus 15:2",
    text: "The LORD is my strength and my song, and He has become my salvation. He is my God, and I will praise Him, my father’s God, and I will exalt Him.",
  },
  {
    reference: "Matthew 7:12",
    text: "In everything, then, do to others as you would have them do to you. For this is the essence of the Law and the Prophets.",
  },
  {
    reference: "Luke 11:9",
    text: "So I tell you: Ask, and it will be given to you; seek, and you will find; knock, and the door will be opened to you.",
  },
  {
    reference: "Psalm 51:10",
    text: "Create in me a clean heart, O God, and renew a right spirit within me.",
  },
  {
    reference: "James 1:22",
    text: "Be doers of the word, and not hearers only. Otherwise, you are deceiving yourselves.",
  },
  {
    reference: "Isaiah 40:31",
    text: "But those who wait upon the LORD will renew their strength; they will mount up with wings like eagles; they will run and not grow weary, they will walk and not faint.",
  },
  {
    reference: "Acts 5:29",
    text: "But Peter and the other apostles replied, We must obey God rather than men.",
  },
  {
    reference: "Revelation 19:6",
    text: "And I heard a sound like the roar of a great multitude, like the rushing of many waters, and like a mighty rumbling of thunder, crying out: Hallelujah! For the Lord our God the Almighty reigns.",
  },
  {
    reference: "Colossians 3:1-2",
    text: "Therefore, since you have been raised with Christ, strive for the things above, where Christ is seated at the right hand of God. Set your minds on things above, not on earthly things.",
  },
  {
    reference: "Romans 8:26",
    text: "In the same way, the Spirit helps us in our weakness. For we do not know how we ought to pray, but the Spirit Himself intercedes for us with groans too deep for words.",
  },
  {
    reference: "John 10:27-28",
    text: "My sheep listen to My voice; I know them, and they follow Me. I give them eternal life, and they will never perish. No one can snatch them out of My hand.",
  },
  {
    reference: "Hebrews 10:24-25",
    text: "And let us consider how to spur one another on to love and good deeds. Let us not neglect meeting together, as some have made a habit, but let us encourage one another, and all the more as you see the Day approaching.",
  },
  {
    reference: "1 Thessalonians 5:11",
    text: "Therefore encourage and build one another up, just as you are already doing.",
  },
  {
    reference: "Galatians 5:1",
    text: "It is for freedom that Christ has set us free. Stand firm, then, and do not be encumbered once more by a yoke of slavery.",
  },
  {
    reference: "2 Corinthians 5:17",
    text: "Therefore if anyone is in Christ, he is a new creation. The old has passed away. Behold, the new has come!",
  },
  {
    reference: "1 Corinthians 12:27",
    text: "Now you are the body of Christ, and each of you is a member of it.",
  },
  {
    reference: "Philippians 3:10-11",
    text: "I want to know Christ and the power of His resurrection and the fellowship of His sufferings, being conformed to Him in His death, and so, somehow, to attain to the resurrection from the dead.",
  },
  {
    reference: "1 John 3:18",
    text: "Little children, let us love not in word and speech, but in action and truth.",
  },
  {
    reference: "Psalm 55:22",
    text: "Cast your burden upon the LORD and He will sustain you; He will never let the righteous be shaken.",
  },
  {
    reference: "Ephesians 4:2-3",
    text: "with all humility and gentleness, with patience, bearing with one another in love, and with diligence to preserve the unity of the Spirit through the bond of peace.",
  },
  {
    reference: "Matthew 9:37-38",
    text: "Then He said to His disciples, “The harvest is plentiful, but the workers are few. Ask the Lord of the harvest, therefore, to send out workers into His harvest.”",
  },
  {
    reference: "1 Peter 4:8",
    text: "Above all, love one another deeply, because love covers over a multitude of sins.",
  },
  {
    reference: "Deuteronomy 18:15",
    text: "The LORD your God will raise up for you a prophet like me from among your brothers. You must listen to him.",
  },
  {
    reference: "John 11:25-26",
    text: "Jesus said to her, “I am the resurrection and the life. Whoever believes in Me will live, even though he dies. And everyone who lives and believes in Me will never die. Do you believe this?”",
  },
  {
    reference: "Romans 8:28",
    text: "And we know that God works all things together for the good of those who love Him, who are called according to His purpose.",
  },
  {
    reference: "Luke 12:15",
    text: "And He said to them, “Watch out! Guard yourselves against every form of greed, for one’s life does not consist in the abundance of his possessions.”",
  },
  {
    reference: "Psalm 62:1-2",
    text: "In God alone my soul finds rest; my salvation comes from Him. He alone is my rock and my salvation. He is my fortress; I will never be shaken.",
  },
  {
    reference: "Proverbs 16:9",
    text: "A man’s heart plans his course, but the LORD determines his steps.",
  },
  {
    reference: "Isaiah 41:10",
    text: "Do not fear, for I am with you; do not be afraid, for I am your God. I will strengthen you; I will surely help you; I will uphold you with My righteous right hand.",
  },
  {
    reference: "Zechariah 4:6",
    text: "So he said to me, This is the word of the LORD to Zerubbabel: Not by might nor by power, but by My Spirit, says the LORD of Hosts.",
  },
  {
    reference: "Hebrews 11:1",
    text: "Now faith is the assurance of what we hope for and the certainty of what we do not see.",
  },
  {
    reference: "2 Thessalonians 3:5",
    text: "May the Lord direct your hearts into God’s love and Christ’s perseverance.",
  },
  {
    reference: "Haggai 2:9",
    text: "The latter glory of this house will be greater than the former, says the LORD of Hosts. And in this place I will provide peace, declares the LORD of Hosts.",
  },
  {
    reference: "Revelation 21:3",
    text: "And I heard a loud voice from the throne saying: Behold, the dwelling place of God is with man, and He will dwell with them. They will be His people, and God Himself will be with them as their God.",
  },
  {
    reference: "Joshua 1:9",
    text: "Have I not commanded you to be strong and courageous? Do not be afraid; do not be discouraged, for the LORD your God is with you wherever you go.",
  },
  {
    reference: "Acts 10:34-35",
    text: "Then Peter began to speak: I now truly understand that God does not show favoritism, but welcomes those from every nation who fear Him and do what is right.",
  },
  {
    reference: "1 Corinthians 13:4-5",
    text: "Love is patient, love is kind. It does not envy, it does not boast, it is not proud. It is not rude, it is not self-seeking, it is not easily angered, it keeps no account of wrongs.",
  },
  {
    reference: "John 12:24",
    text: "Truly, truly, I tell you, unless a kernel of wheat falls to the ground and dies, it remains only a seed. But if it dies, it bears much fruit.",
  },
  {
    reference: "Matthew 10:29-31",
    text: "Are not two sparrows sold for a penny? Yet not one of them will fall to the ground apart from the will of your Father. And even the very hairs of your head are all numbered. So do not be afraid; you are worth more than many sparrows.",
  },
  {
    reference: "Mark 10:14",
    text: "But when Jesus saw this, He was indignant and told them, Let the little children come to Me, and do not hinder them! For the kingdom of God belongs to such as these.",
  },
  {
    reference: "Genesis 12:3",
    text: "I will bless those who bless you and curse those who curse you; and all the families of the earth will be blessed through you.",
  },
  {
    reference: "Psalm 73:26",
    text: "My flesh and my heart may fail, but God is the strength of my heart and my portion forever.",
  },
  {
    reference: "Romans 8:31",
    text: "What then shall we say in response to these things? If God is for us, who can be against us?",
  },
  {
    reference: "2 Corinthians 5:20",
    text: "Therefore we are ambassadors for Christ, as though God were making His appeal through us. We implore you on behalf of Christ: Be reconciled to God.",
  },
  {
    reference: "James 1:27",
    text: "Pure and undefiled religion before our God and Father is this: to care for orphans and widows in their distress, and to keep oneself from being polluted by the world.",
  },
  {
    reference: "Colossians 3:12",
    text: "Therefore, as the elect of God, holy and beloved, clothe yourselves with hearts of compassion, kindness, humility, gentleness, and patience.",
  },
  {
    reference: "Philippians 3:13-14",
    text: "Brothers, I do not consider myself yet to have taken hold of it. But one thing I do: Forgetting what is behind and straining toward what is ahead, I press on toward the goal to win the prize of God’s heavenly calling in Christ Jesus.",
  },
  {
    reference: "Luke 12:32",
    text: "Do not be afraid, little flock, for your Father is pleased to give you the kingdom.",
  },
  {
    reference: "Ephesians 4:15",
    text: "Instead, speaking the truth in love, we will in all things grow up into Christ Himself, who is the head.",
  },
  {
    reference: "1 John 4:7-8",
    text: "Beloved, let us love one another, because love comes from God. Everyone who loves has been born of God and knows God. Whoever does not love does not know God, because God is love.",
  },
  {
    reference: "Galatians 5:13",
    text: "For you, brothers, were called to freedom; but do not use your freedom as an opportunity for the flesh. Rather, serve one another in love.",
  },
  {
    reference: "Psalm 84:11",
    text: "For the LORD God is a sun and a shield; the LORD gives grace and glory; He withholds no good thing from those who walk with integrity.",
  },
  {
    reference: "John 13:34-35",
    text: "A new commandment I give you: Love one another. As I have loved you, so you also must love one another. By this everyone will know that you are My disciples, if you love one another.",
  },
  {
    reference: "Isaiah 43:1",
    text: "But now, this is what the LORD says— He who created you, O Jacob, and He who formed you, O Israel: Do not fear, for I have redeemed you; I have called you by your name; you are Mine!",
  },
  {
    reference: "Hebrews 11:3",
    text: "By faith we understand that the universe was formed at God’s command, so that what is seen was not made out of what was visible.",
  },
  {
    reference: "2 Timothy 2:15",
    text: "Make every effort to present yourself approved to God, an unashamed workman who accurately handles the word of truth.",
  },
  {
    reference: "1 Peter 4:10",
    text: "As good stewards of the manifold grace of God, each of you should use whatever gift he has received to serve one another.",
  },
  {
    reference: "Matthew 11:28",
    text: "Come to Me, all you who are weary and burdened, and I will give you rest.",
  },
  {
    reference: "Romans 8:37",
    text: "No, in all these things we are more than conquerors through Him who loved us.",
  },
  {
    reference: "Jeremiah 31:3",
    text: "The LORD appeared to us in the past, saying: I have loved you with an everlasting love; therefore I have drawn you with loving devotion.",
  },
  {
    reference: "1 Timothy 6:6-7",
    text: "Of course, godliness with contentment is great gain. For we brought nothing into the world, so we cannot carry anything out of it.",
  },
  {
    reference: "1 Corinthians 13:7",
    text: "It bears all things, believes all things, hopes all things, endures all things.",
  },
  {
    reference: "2 Peter 1:20-21",
    text: "Above all, you must understand that no prophecy of Scripture comes from one’s own interpretation. For no such prophecy was ever brought forth by the will of man, but men spoke from God as they were carried along by the Holy Spirit.",
  },
  {
    reference: "Habakkuk 2:14",
    text: "For the earth will be filled with the knowledge of the glory of the LORD as the waters cover the sea.",
  },
  {
    reference: "Revelation 21:4",
    text: "‘He will wipe away every tear from their eyes,’ and there will be no more death or mourning or crying or pain, for the former things have passed away.",
  },
  {
    reference: "Psalm 90:12",
    text: "So teach us to number our days, that we may present a heart of wisdom.",
  },
  {
    reference: "John 14:1",
    text: "Do not let your hearts be troubled. You believe in God; believe in Me as well.",
  },
  {
    reference: "Acts 16:31",
    text: "They replied, “Believe in the Lord Jesus and you will be saved, you and your household.”",
  },
  {
    reference: "2 John 1:6",
    text: "And this is love, that we walk according to His commandments. This is the very commandment you have heard from the beginning, that you must walk in love.",
  },
  {
    reference: "2 Corinthians 5:21",
    text: "God made Him who knew no sin to be sin on our behalf, so that in Him we might become the righteousness of God.",
  },
  {
    reference: "Luke 15:7",
    text: "I tell you that in the same way there will be more joy in heaven over one sinner who repents than over ninety-nine righteous ones who do not need to repent.",
  },
  {
    reference: "Romans 8:38-39",
    text: "For I am convinced that neither death nor life, neither angels nor principalities, neither the present nor the future, nor any powers, neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.",
  },
  {
    reference: "Matthew 11:29-30",
    text: "Take My yoke upon you and learn from Me, for I am gentle and humble in heart, and you will find rest for your souls. For My yoke is easy and My burden is light.",
  },
  {
    reference: "Hebrews 11:6",
    text: "And without faith it is impossible to please God. For anyone who approaches Him must believe that He exists and that He rewards those who earnestly seek Him.",
  },
  {
    reference: "Psalm 91:1-2",
    text: "He who dwells in the shelter of the Most High will abide in the shadow of the Almighty. I will say to the LORD, “You are my refuge and my fortress, my God, in whom I trust.”",
  },
  {
    reference: "Isaiah 43:19",
    text: "Behold, I am about to do something new; even now it is coming. Do you not see it? Indeed, I will make a way in the wilderness and streams in the desert.",
  },
  {
    reference: "Ephesians 4:29",
    text: "Let no unwholesome talk come out of your mouths, but only what is helpful for building up the one in need and bringing grace to those who listen.",
  },
  {
    reference: "Mark 10:27",
    text: "Jesus looked at them and said, “With man this is impossible, but not with God. For all things are possible with God.”",
  },
  {
    reference: "Philippians 4:4-5",
    text: "Rejoice in the Lord always. I will say it again: Rejoice! Let your gentleness be apparent to all. The Lord is near.",
  },
  {
    reference: "John 14:6",
    text: "Jesus answered, I am the way and the truth and the life. No one comes to the Father except through Me.",
  },
  {
    reference: "1 Corinthians 13:12",
    text: "Now we see but a dim reflection as in a mirror; then we shall see face to face. Now I know in part; then I shall know fully, even as I am fully known.",
  },
  {
    reference: "Proverbs 18:10",
    text: "The name of the LORD is a strong tower; the righteous run to it and are safe.",
  },
  {
    reference: "James 2:17",
    text: "So too, faith by itself, if it does not result in action, is dead.",
  },
  {
    reference: "Colossians 3:13",
    text: "Bear with one another and forgive any complaint you may have against someone else. Forgive as the Lord forgave you.",
  },
  {
    reference: "2 Samuel 22:31",
    text: "As for God, His way is perfect; the word of the LORD is flawless. He is a shield to all who take refuge in Him.",
  },
  {
    reference: "1 John 4:10",
    text: "And love consists in this: not that we loved God, but that He loved us and sent His Son as the atoning sacrifice for our sins.",
  },
  {
    reference: "1 Peter 5:6",
    text: "Humble yourselves, therefore, under God’s mighty hand, so that in due time He may exalt you.",
  },
  {
    reference: "Psalm 103:12",
    text: "As far as the east is from the west, so far has He removed our transgressions from us.",
  },
  {
    reference: "Exodus 20:2-3",
    text: "I am the LORD your God, who brought you out of the land of Egypt, out of the house of slavery. You shall have no other gods before Me.",
  },
  {
    reference: "Romans 10:9",
    text: "that if you confess with your mouth, “Jesus is Lord,” and believe in your heart that God raised Him from the dead, you will be saved.",
  },
  {
    reference: "Galatians 5:16",
    text: "So I say, walk by the Spirit, and you will not gratify the desires of the flesh.",
  },
  {
    reference: "Matthew 16:24",
    text: "Then Jesus told His disciples, If anyone wants to come after Me, he must deny himself and take up his cross and follow Me.",
  },
  {
    reference: "Revelation 21:5",
    text: "And the One seated on the throne said, “Behold, I make all things new.” Then He said, “Write this down, for these words are faithful and true.”",
  },
  {
    reference: "Genesis 15:6",
    text: "Abram believed the LORD, and it was credited to him as righteousness.",
  },
  {
    reference: "Luke 15:20",
    text: "So he got up and went to his father. But while he was still in the distance, his father saw him and was filled with compassion. He ran to his son, embraced him, and kissed him.",
  },
  {
    reference: "Deuteronomy 31:6",
    text: "Be strong and courageous; do not be afraid or terrified of them, for it is the LORD your God who goes with you; He will never leave you nor forsake you.",
  },
  {
    reference: "John 14:15",
    text: "If you love Me, you will keep My commandments.",
  },
  {
    reference: "Hebrews 12:1",
    text: "Therefore, since we are surrounded by such a great cloud of witnesses, let us throw off every encumbrance and the sin that so easily entangles, and let us run with endurance the race set out for us.",
  },
  {
    reference: "1 Thessalonians 5:16-18",
    text: "Rejoice at all times. Pray without ceasing. Give thanks in every circumstance, for this is God’s will for you in Christ Jesus.",
  },
  {
    reference: "Acts 17:24-25",
    text: "The God who made the world and everything in it is the Lord of heaven and earth and does not live in temples made by human hands. Nor is He served by human hands, as if He needed anything, because He Himself gives everyone life and breath and everything else.",
  },
  {
    reference: "Psalm 110:1",
    text: "The LORD said to my Lord: “Sit at My right hand until I make Your enemies a footstool for Your feet.”",
  },
  {
    reference: "2 Corinthians 9:7",
    text: "Each one should give what he has decided in his heart to give, not out of regret or compulsion. For God loves a cheerful giver.",
  },
  {
    reference: "Isaiah 53:5",
    text: "But He was pierced for our transgressions, He was crushed for our iniquities; the punishment that brought us peace was upon Him, and by His stripes we are healed.",
  },
  {
    reference: "Titus 3:4-5",
    text: "But when the kindness of God our Savior and His love for mankind appeared, He saved us, not by the righteous deeds we had done, but according to His mercy, through the washing of new birth and renewal by the Holy Spirit.",
  },
  {
    reference: "Romans 10:13",
    text: "for, “Everyone who calls on the name of the Lord will be saved.”",
  },
  {
    reference: "1 Corinthians 13:13",
    text: "And now these three remain: faith, hope, and love; but the greatest of these is love.",
  },
  {
    reference: "Ecclesiastes 12:13",
    text: "When all has been heard, the conclusion of the matter is this: Fear God and keep His commandments, because this is the whole duty of man.",
  },
  {
    reference: "Ephesians 4:32",
    text: "Be kind and tenderhearted to one another, forgiving each other just as in Christ God forgave you.",
  },
  {
    reference: "John 14:27",
    text: "Peace I leave with you; My peace I give to you. I do not give to you as the world gives. Do not let your hearts be troubled; do not be afraid.",
  },
  {
    reference: "Matthew 18:20",
    text: "For where two or three gather together in My name, there am I with them.",
  },
  {
    reference: "Psalm 118:22",
    text: "The stone the builders rejected has become the cornerstone.",
  },
  {
    reference: "Philippians 4:6-7",
    text: "Be anxious for nothing, but in everything, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.",
  },
  {
    reference: "2 Timothy 3:16-17",
    text: "All Scripture is God-breathed and is useful for instruction, for conviction, for correction, and for training in righteousness, so that the man of God may be complete, fully equipped for every good work.",
  },
  {
    reference: "Luke 18:27",
    text: "But Jesus said, “What is impossible with man is possible with God.”",
  },
  {
    reference: "Mark 10:45",
    text: "For even the Son of Man did not come to be served, but to serve, and to give His life as a ransom for many.",
  },
  {
    reference: "Hebrews 12:2",
    text: "Let us fix our eyes on Jesus, the author and perfecter of our faith, who for the joy set before Him endured the cross, scorning its shame, and sat down at the right hand of the throne of God.",
  },
  {
    reference: "Jeremiah 31:33",
    text: "But this is the covenant I will make with the house of Israel after those days, declares the LORD. I will put My law in their minds and inscribe it on their hearts. And I will be their God, and they will be My people.",
  },
  {
    reference: "1 Peter 5:7",
    text: "Cast all your anxiety on Him, because He cares for you.",
  },
  {
    reference: "Romans 10:17",
    text: "Consequently, faith comes by hearing, and hearing by the word of Christ.",
  },
  {
    reference: "Revelation 21:6",
    text: "And He told me, It is done! I am the Alpha and the Omega, the Beginning and the End. To the thirsty I will give freely from the spring of the water of life.",
  },
  {
    reference: "James 3:17",
    text: "But the wisdom from above is first of all pure, then peace-loving, gentle, accommodating, full of mercy and good fruit, impartial, and sincere.",
  },
  {
    reference: "1 John 4:16",
    text: "And we have come to know and believe the love that God has for us. God is love; whoever abides in love abides in God, and God in him.",
  },
  {
    reference: "Psalm 118:24",
    text: "This is the day that the LORD has made; we will rejoice and be glad in it.",
  },
  {
    reference: "John 15:5",
    text: "I am the vine and you are the branches. The one who remains in Me, and I in him, will bear much fruit. For apart from Me you can do nothing.",
  },
  {
    reference: "Colossians 3:15",
    text: "Let the peace of Christ rule in your hearts, for to this you were called as members of one body. And be thankful.",
  },
  {
    reference: "Isaiah 53:6",
    text: "We all like sheep have gone astray, each one has turned to his own way; and the LORD has laid upon Him the iniquity of us all.",
  },
  {
    reference: "Daniel 7:13",
    text: "In my vision in the night I continued to watch, and I saw One like the Son of Man coming with the clouds of heaven. He approached the Ancient of Days and was led into His presence.",
  },
  {
    reference: "1 Corinthians 15:3-5",
    text: "For what I received I passed on to you as of first importance: that Christ died for our sins according to the Scriptures, that He was buried, that He was raised on the third day according to the Scriptures, and that He appeared to Cephas and then to the Twelve.",
  },
  {
    reference: "Matthew 20:28",
    text: "just as the Son of Man did not come to be served, but to serve, and to give His life as a ransom for many.",
  },
  {
    reference: "2 Corinthians 9:8",
    text: "And God is able to make all grace abound to you, so that in all things, at all times, having all that you need, you will abound in every good work.",
  },
  {
    reference: "Acts 17:27",
    text: "God intended that they would seek Him and perhaps reach out for Him and find Him, though He is not far from each one of us.",
  },
  {
    reference: "Galatians 5:22-23",
    text: "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, and self-control. Against such things there is no law.",
  },
  {
    reference: "1 Timothy 6:11",
    text: "But you, O man of God, flee from these things and pursue righteousness, godliness, faith, love, perseverance, and gentleness.",
  },
  {
    reference: "Ephesians 5:1-2",
    text: "Be imitators of God, therefore, as beloved children, and walk in love, just as Christ loved us and gave Himself up for us as a fragrant sacrificial offering to God.",
  },
  {
    reference: "Psalm 119:105",
    text: "Your word is a lamp to my feet and a light to my path.",
  },
  {
    reference: "Proverbs 27:17",
    text: "As iron sharpens iron, so one man sharpens another.",
  },
  {
    reference: "Romans 12:1",
    text: "Therefore I urge you, brothers, on account of God’s mercy, to offer your bodies as living sacrifices, holy and pleasing to God, which is your spiritual service of worship.",
  },
  {
    reference: "Job 42:2",
    text: "I know that You can do all things and that no plan of Yours can be thwarted.",
  },
  {
    reference: "John 15:13",
    text: "Greater love has no one than this, that he lay down his life for his friends.",
  },
  {
    reference: "Luke 19:10",
    text: "For the Son of Man came to seek and to save the lost.",
  },
  {
    reference: "Hebrews 12:11",
    text: "No discipline seems enjoyable at the time, but painful. Later on, however, it yields a harvest of righteousness and peace to those who have been trained by it.",
  },
  {
    reference: "2 Thessalonians 3:13",
    text: "But as for you, brothers, do not grow weary in well-doing.",
  },
  {
    reference: "Micah 6:8",
    text: "He has shown you, O man, what is good. And what does the LORD require of you but to act justly, to love mercy, and to walk humbly with your God?",
  },
  {
    reference: "1 Samuel 16:7",
    text: "But the LORD said to Samuel, “Do not consider his appearance or height, for I have rejected him; the LORD does not see as man does. For man sees the outward appearance, but the LORD sees the heart.”",
  },
  {
    reference: "2 Peter 3:9",
    text: "The Lord is not slow in keeping His promise as some understand slowness, but is patient with you, not wanting anyone to perish but everyone to come to repentance.",
  },
  {
    reference: "Matthew 22:37-39",
    text: "Jesus declared, ‘Love the Lord your God with all your heart and with all your soul and with all your mind.’ This is the first and greatest commandment. And the second is like it: ‘Love your neighbor as yourself.’",
  },
  {
    reference: "Genesis 22:8",
    text: "Abraham answered, “God Himself will provide the lamb for the burnt offering, my son.” And the two walked on together.",
  },
  {
    reference: "Philippians 4:8",
    text: "Finally, brothers, whatever is true, whatever is honorable, whatever is right, whatever is pure, whatever is lovely, whatever is admirable—if anything is excellent or praiseworthy—think on these things.",
  },
  {
    reference: "Psalm 121:1-2",
    text: "I lift up my eyes to the hills. From where does my help come? My help comes from the LORD, the Maker of heaven and earth.",
  },
  {
    reference: "Isaiah 55:8-9",
    text: "For My thoughts are not your thoughts, neither are your ways My ways,” declares the LORD. “For as the heavens are higher than the earth, so My ways are higher than your ways and My thoughts than your thoughts.",
  },
  {
    reference: "Revelation 22:13",
    text: "I am the Alpha and the Omega, the First and the Last, the Beginning and the End.",
  },
  {
    reference: "1 Corinthians 15:20",
    text: "But Christ has indeed been raised from the dead, the firstfruits of those who have fallen asleep.",
  },
  {
    reference: "Romans 12:2",
    text: "Do not be conformed to this world, but be transformed by the renewing of your mind. Then you will be able to test and approve what is the good, pleasing, and perfect will of God.",
  },
  {
    reference: "John 16:33",
    text: "I have told you these things so that in Me you may have peace. In the world you will have tribulation. But take courage; I have overcome the world!",
  },
  {
    reference: "1 Peter 5:8-9",
    text: "Be sober-minded and alert. Your adversary the devil prowls around like a roaring lion, seeking someone to devour. Resist him, standing firm in your faith and in the knowledge that your brothers throughout the world are undergoing the same kinds of suffering.",
  },
  {
    reference: "Mark 11:24",
    text: "Therefore I tell you, whatever you ask for in prayer, believe that you have received it, and it will be yours.",
  },
  {
    reference: "2 Corinthians 10:5",
    text: "We demolish arguments and every presumption set up against the knowledge of God; and we take captive every thought to make it obedient to Christ.",
  },
  {
    reference: "1 John 4:19",
    text: "We love because He first loved us.",
  },
  {
    reference: "Acts 17:28",
    text: "‘For in Him we live and move and have our being.’ As some of your own poets have said, ‘We are His offspring.’",
  },
  {
    reference: "Psalm 130:3-4",
    text: "If You, O LORD, kept track of iniquities, then who, O Lord, could stand? But with You there is forgiveness, so that You may be feared.",
  },
  {
    reference: "James 4:8",
    text: "Draw near to God, and He will draw near to you. Cleanse your hands, you sinners, and purify your hearts, you double-minded.",
  },
  {
    reference: "Hebrews 13:5",
    text: "Keep your lives free from the love of money and be content with what you have, for God has said: “Never will I leave you, never will I forsake you.”",
  },
  {
    reference: "Luke 21:33",
    text: "Heaven and earth will pass away, but My words will never pass away.",
  },
  {
    reference: "Colossians 3:16",
    text: "Let the word of Christ richly dwell within you as you teach and admonish one another with all wisdom, and as you sing psalms, hymns, and spiritual songs with gratitude in your hearts to God.",
  },
  {
    reference: "Malachi 4:2",
    text: "But for you who fear My name, the sun of righteousness will rise with healing in its wings, and you will go out and leap like calves from the stall.",
  },
  {
    reference: "Ephesians 6:10",
    text: "Finally, be strong in the Lord and in His mighty power.",
  },
  {
    reference: "Matthew 25:40",
    text: "And the King will reply, ‘Truly I tell you, whatever you did for one of the least of these brothers of Mine, you did for Me.’",
  },
  {
    reference: "Deuteronomy 31:8",
    text: "The LORD Himself goes before you; He will be with you. He will never leave you nor forsake you. Do not be afraid or discouraged.",
  },
  {
    reference: "John 17:3",
    text: "Now this is eternal life, that they may know You, the only true God, and Jesus Christ, whom You have sent.",
  },
  {
    reference: "Romans 12:12",
    text: "Be joyful in hope, patient in affliction, persistent in prayer.",
  },
  {
    reference: "Galatians 6:2",
    text: "Carry one another’s burdens, and in this way you will fulfill the law of Christ.",
  },
  {
    reference: "Jude 1:24-25",
    text: "Now to Him who is able to keep you from stumbling and to present you unblemished in His glorious presence, with great joy— to the only God our Savior be glory, majesty, dominion, and authority through Jesus Christ our Lord before all time, and now, and for all eternity. Amen.",
  },
  {
    reference: "Psalm 139:14",
    text: "I praise You, for I am fearfully and wonderfully made. Marvelous are Your works, and I know this very well.",
  },
  {
    reference: "Isaiah 55:11",
    text: "so My word that proceeds from My mouth will not return to Me empty, but it will accomplish what I please, and it will prosper where I send it.",
  },
  {
    reference: "1 Corinthians 15:57",
    text: "But thanks be to God, who gives us the victory through our Lord Jesus Christ!",
  },
  {
    reference: "Exodus 33:14",
    text: "And the LORD answered, “My Presence will go with you, and I will give you rest.”",
  },
  {
    reference: "Joel 2:32",
    text: "And everyone who calls on the name of the LORD will be saved; for on Mount Zion and in Jerusalem there will be deliverance, as the LORD has promised, among the remnant called by the LORD.",
  },
  {
    reference: "2 Timothy 4:7-8",
    text: "I have fought the good fight, I have finished the race, I have kept the faith. From now on there is laid up for me the crown of righteousness, which the Lord, the righteous Judge, will award to me on that day—and not only to me, but to all who crave His appearing.",
  },
  {
    reference: "Revelation 22:17",
    text: "The Spirit and the bride say, “Come!” Let the one who hears say, “Come!” And let the one who is thirsty come, and the one who desires the water of life drink freely.",
  },
  {
    reference: "Philippians 4:13",
    text: "I can do all things through Christ who gives me strength.",
  },
  {
    reference: "Jeremiah 33:3",
    text: "Call to Me, and I will answer and show you great and unsearchable things you do not know.",
  },
  {
    reference: "John 20:29",
    text: "Jesus said to him, “Because you have seen Me, you have believed; blessed are those who have not seen and yet have believed.”",
  },
  {
    reference: "Matthew 28:19-20",
    text: "Therefore go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit, and teaching them to obey all that I have commanded you. And surely I am with you always, even to the end of the age.",
  },
  {
    reference: "Hebrews 13:8",
    text: "Jesus Christ is the same yesterday and today and forever.",
  },
  {
    reference: "Psalm 139:23-24",
    text: "Search me, O God, and know my heart; test me and know my concerns. See if there is any offensive way in me; lead me in the way everlasting.",
  },
  {
    reference: "1 Thessalonians 5:23-24",
    text: "Now may the God of peace Himself sanctify you completely, and may your entire spirit, soul, and body be kept blameless at the coming of our Lord Jesus Christ. The One who calls you is faithful, and He will do it.",
  },
  {
    reference: "Romans 15:13",
    text: "Now may the God of hope fill you with all joy and peace as you believe in Him, so that you may overflow with hope by the power of the Holy Spirit.",
  },
  {
    reference: "Luke 24:6-7",
    text: "He is not here; He has risen! Remember how He told you while He was still in Galilee: ‘The Son of Man must be delivered into the hands of sinful men, and be crucified, and on the third day rise again.’",
  },
  {
    reference: "2 Corinthians 12:9",
    text: "But He said to me, “My grace is sufficient for you, for My power is perfected in weakness.” Therefore I will boast all the more gladly in my weaknesses, so that the power of Christ may rest on me.",
  },
  {
    reference: "1 Peter 5:10",
    text: "And after you have suffered for a little while, the God of all grace, who has called you to His eternal glory in Christ, will Himself restore you, secure you, strengthen you, and establish you.",
  },
  {
    reference: "Acts 20:35",
    text: "In everything, I showed you that by this kind of hard work we must help the weak, remembering the words of the Lord Jesus Himself: ‘It is more blessed to give than to receive.’",
  },
  {
    reference: "Proverbs 30:5",
    text: "Every word of God is flawless; He is a shield to those who take refuge in Him.",
  },
  {
    reference: "Ephesians 6:11",
    text: "Put on the full armor of God, so that you can make your stand against the devil’s schemes.",
  },
  {
    reference: "Philemon 1:6",
    text: "I pray that your partnership in the faith may become effective as you fully acknowledge every good thing that is ours in Christ.",
  },
  {
    reference: "1 John 5:14",
    text: "And this is the confidence that we have before Him: If we ask anything according to His will, He hears us.",
  },
  {
    reference: "Psalm 145:8",
    text: "The LORD is gracious and compassionate, slow to anger and abounding in loving devotion.",
  },
  {
    reference: "Mark 12:30-31",
    text: "Love the Lord your God with all your heart and with all your soul and with all your mind and with all your strength.’ The second is this: ‘Love your neighbor as yourself.’ No other commandment is greater than these.",
  },
  {
    reference: "1 Corinthians 16:13-14",
    text: "Be on the alert. Stand firm in the faith. Be men of courage. Be strong. Do everything in love.",
  },
  {
    reference: "John 20:31",
    text: "But these are written so that you may believe that Jesus is the Christ, the Son of God, and that by believing you may have life in His name.",
  },
  {
    reference: "Isaiah 61:10",
    text: "I will rejoice greatly in the LORD, my soul will exult in my God; for He has clothed me with garments of salvation and wrapped me in a robe of righteousness, as a bridegroom wears a priestly headdress, as a bride adorns herself with her jewels.",
  },
  {
    reference: "Zephaniah 3:17",
    text: "The LORD your God is among you; He is mighty to save. He will rejoice over you with gladness; He will quiet you with His love; He will rejoice over you with singing.",
  },
  {
    reference: "James 5:16",
    text: "Therefore confess your sins to each other and pray for each other so that you may be healed. The prayer of a righteous man has great power to prevail.",
  },
  {
    reference: "Genesis 50:20",
    text: "As for you, what you intended against me for evil, God intended for good, in order to accomplish a day like this—to preserve the lives of many people.",
  },
  {
    reference: "1 Timothy 6:12",
    text: "Fight the good fight of the faith. Take hold of the eternal life to which you were called when you made the good confession before many witnesses.",
  },
  {
    reference: "Colossians 3:23-24",
    text: "Whatever you do, work at it with your whole being, as for the Lord and not for men, because you know that you will receive an inheritance from the Lord as your reward. It is the Lord Christ you are serving.",
  },
  {
    reference: "Galatians 6:9",
    text: "Let us not grow weary in well-doing, for in due time we will reap a harvest if we do not give up.",
  },
  {
    reference: "Numbers 6:24-26",
    text: "‘May the LORD bless you and keep you; may the LORD cause His face to shine upon you and be gracious to you; may the LORD lift up His countenance toward you and give you peace.’",
  },
  {
    reference: "Ezekiel 36:26",
    text: "I will give you a new heart and put a new spirit within you; I will remove your heart of stone and give you a heart of flesh.",
  },
  {
    reference: "2 Peter 3:18",
    text: "But grow in the grace and knowledge of our Lord and Savior Jesus Christ. To Him be the glory both now and to the day of eternity. Amen.",
  },
  {
    reference: "Zechariah 9:9",
    text: "Rejoice greatly, O Daughter of Zion! Shout in triumph, O Daughter of Jerusalem! See, your King comes to you, righteous and victorious, humble and riding on a donkey, on a colt, the foal of a donkey.",
  },
  {
    reference: "Titus 3:8",
    text: "This saying is trustworthy. And I want you to emphasize these things, so that those who have believed God will take care to devote themselves to good deeds. These things are excellent and profitable for the people.",
  },
  {
    reference: "1 Kings 8:23",
    text: "and said: O LORD, God of Israel, there is no God like You in heaven above or on earth below, keeping Your covenant of loving devotion with Your servants who walk before You with all their hearts.",
  },
  {
    reference: "Joshua 24:15",
    text: "But if it is unpleasing in your sight to serve the LORD, then choose for yourselves this day whom you will serve, whether the gods your fathers served beyond the Euphrates, or the gods of the Amorites in whose land you are living. As for me and my house, we will serve the LORD!",
  },
  {
    reference: "Jonah 2:9",
    text: "But I, with the voice of thanksgiving, will sacrifice to You. I will fulfill what I have vowed. Salvation is from the LORD!",
  },
  {
    reference: "Habakkuk 3:17-18",
    text: "Though the fig tree does not bud and no fruit is on the vines, though the olive crop fails and the fields produce no food, though the sheep are cut off from the fold and no cattle are in the stalls, yet I will exult in the LORD; I will rejoice in the God of my salvation!",
  },
  {
    reference: "Hosea 6:6",
    text: "For I desire mercy, not sacrifice, and the knowledge of God rather than burnt offerings.",
  },
  {
    reference: "3 John 1:4",
    text: "I have no greater joy than to hear that my children are walking in the truth.",
  },
  {
    reference: "Leviticus 19:18",
    text: "Do not seek revenge or bear a grudge against any of your people, but love your neighbor as yourself. I am the LORD.",
  },
  {
    reference: "Lamentations 3:22-23",
    text: "Because of the loving devotion of the LORD we are not consumed, for His mercies never fail. They are new every morning; great is Your faithfulness!",
  },
];

/** Whole days since the Unix epoch, in UTC. */
function epochDay(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000,
  );
}

/** Deterministic by calendar date (UTC) — same verse all day, everywhere,
 *  rather than a new one on every reload. */
export function verseOfTheDay(date: Date = new Date()): Verse {
  const index = epochDay(date) % VERSES.length;
  return VERSES[index];
}
