// Hand-curated etymology lexicon. Each list is space-separated.
// Policy: a word is filed under the language family it entered English from
// (Latin includes French/Italian/Spanish; Greek only when it still reads as Greek).
// Earlier categories win if a word appears twice.
const LEXICON_SOURCES = {
  norse: `they them their theirs skin sky egg window anger ugly happy wrong skill skirt scare scared scrape seat
    knife law cake kid husband leg low loose odd same though weak wing want both get give gift ill die dirt flat
    freckle gap gasp glitter hug lift loan mistake muggy rag raise rotten rugged scale scalp scatter score scowl
    skate skid skull slaughter sly snub steak stagger tangle thrust thrift tidings trust whisk whirl wand awe bait
    bank bark bask billow birth bleak bloom boon booth bulk call cast cluster crawl creak crook dazzle dwell fellow
    fit flit flounder gawk hail hale keel lad lag lug meek mire nag nay reindeer rid scab scant scoop scrub seem
    snare sprint stack stir take tether thrall tight trot swain cog club die dregs fog gasp glee guess hit hustle
    kindle lever lump mug nit plough rake rig root rump scrap shank sister-in-law skip slack slant sleight slope
    slouch smile sprawl stagger swirl thrive tot tow ugly vane wail wallow whisk race raft ransack reef rive
    rugged saga sleuth snag snipe sorrow? stunt swap swindle`.replace("sorrow?", ""),

  celtic: `whisky whiskey clan glen loch slogan bard bog crag galore brogue plaid tartan cairn kilt bairn wee aye kirk
    lass lassie laddie ken dinnae cannae didnae wasnae isnae bonnie bonny brae ceilidh claymore sporran shamrock
    banshee leprechaun colleen smithereens shenanigans slew trousers druid bannock flannel penguin coracle corgi
    hubbub gob glom tory pet-name dunno-not-celtic crack-not`.replace(/\S*-not\S*|pet-name/g, ""),

  greek: `music philosophy psychology history theory theater theatre energy atmosphere planet character chaos chorus
    chrome climate comedy tragedy crisis critic cycle democracy dialogue drama economy ecstasy elephant enthusiasm
    episode ethics hero heroes heroic hymn hypocrite irony ironic labyrinth logic magic mechanic melody metal method
    mystery myth nectar orchestra organ paradise pathos period phase phantom photograph physical poem poet poetry
    politics practice problem program prophet rhythm school scheme skeleton symbol sympathy system technique telephone
    theme thesis tone topic trophy tyrant zone angel apostle bible bishop church devil alphabet atom aroma anthem
    pirate chronic sphere stomach ocean dragon gas panic echo harmony idol lyric lyrics melancholy nymph olive orphan
    phrase plastic sarcasm scandal tactic telescope thermal butter geography biology zoology astronomy anatomy
    architecture catastrophe chemistry diagnosis dilemma dynamic electric electricity encyclopedia enigma epic
    euphoria genesis geometry grammar hysteria idea idiom ideal isotope kaleidoscope lexicon marathon mathematics
    metaphor meteor monarch monotone paradox parallel pause phenomenon philosophy physics pneumonia poise prism
    rhetoric rhyme siren sophisticated spasm strategy synthesis tantalize tempo therapy thermometer tragic trauma
    utopia xylophone zeal zephyr cosmos cosmic crystal democracy diamond  drug eclipse ether gymnasium helium
    hippopotamus horizon hydrogen hygiene hypothesis iris kudos lethargy lunatic-not mammoth-not nostalgia oasis
    odyssey oxygen pharmacy pedagogue plague-not pseudonym python rhinoceros saga-not scepter sceptic sceptre
    stigma stoic stylus sympathy tantrum-not thorax tyranny zodiac`.replace(/\S+-not/g, ""),

  other: `coffee sugar cotton algebra alcohol magazine sofa zero cipher candy tea chocolate tomato potato banana canoe
    hammock barbecue hurricane yoga pajamas pyjamas shampoo bungalow jungle guru karma ketchup tycoon tsunami kimono
    karaoke robot vodka amen hallelujah sabbath messiah rabbi kosher cheetah safari zebra giraffe orange lemon
    lime syrup sherbet sultan harem admiral assassin azure caravan checkmate elixir gazelle genie ghoul hazard
    jar julep lute mattress monsoon mummy nadir safari scarlet sequin sorbet tariff typhoon zenith alcove arsenal
    bazaar caftan chess crimson divan emir giraffe henna hookah jasmine khaki lilac minaret mosque paradise-not
    pasha pundit raj sari sheikh turban veranda bandana cashmere chintz cot dinghy loot juggernaut shawl thug
    toddy bangle bamboo ketchup orangutan paddy typhoon tattoo taboo kayak igloo moose raccoon skunk squash
    tomahawk wigwam chipmunk pecan hickory`.replace(/\S+-not/g, ""),

  latin: `people very use used move change place question just because face voice nature nation power point part court
    cause case cost count country course cover create cry culture danger decide different difficult direct discover
    distance doubt effect enemy enter entire equal error escape event example expect experience explain express fact
    family favor favour figure final force form fortune future general gentle grace grand grave guide honor honour
    hour human image important interest join journey judge large letter liberty line machine manner marry master
    matter measure memory mercy minute moment money mountain natural necessary notice number object occasion offer
    office order ordinary pain pass peace perfect person picture pity plain please poor power prayer praise present
    press prince prison promise proud pure quiet reason receive remain remember repeat rest return rich river round
    safe save scene season second secret sense serve service sign silence simple sir soldier sort sound spirit
    square state story strange street study sure surprise table terrible touch turn travel trouble value view
    village virtue visit voice voyage waste age air arrive art attack beast beauty beautiful blame brave calm castle
    cattle certain chair chance charge charm chase clear close color colour comfort common company consider contain
    control copy corner crown curious damage dance dame defend delight desire destroy dine dinner double dress duty
    easy enjoy fail faint faith false fame fancy fashion fault feast fierce flame flower flute fool fruit fury gain
    garden gay giant glory grain grief guard haste honest horror inch jewel joy jury justice labor labour lantern
    lesson level lion main mirror mission noble noise nurse obey pale paper party passion patient pay pearl peasant
    perhaps pilgrim plate pleasure poison pray price prove public push rage rare real reign religion rent robe rock
    romance rose royal ruin rule sacred saint satisfy savage scarce science search slave solemn solid spice spy stable
    stage stain stranger stupid suffer supper tempt tender terror tower treasure tremble umbrella union vain victory
    carry cheese wine mile pound kitchen pepper pillow candle cup dish mass mint pear plum sack cook copper
    ancient animal answer apartment appear arm-not army arrange art article ask-not aunt avoid bank-not battle
    beef belief believe benefit blanket boil bottle branch bridge-not brush button cabin cage cancel candle
    capital captain card care-not carpet cartoon cash catch cause cellar centre center century chain challenge
    champion channel chapter chief choice circle citizen city class clothes coast coat collar collect column
    command commit compare complete concern condition conduct confess confuse connect conquer content continue
    contract conversation cousin crime cruel cure curtain custom dare-not debt deceive declare deliver demand deny
    depend describe desert design detail develop devote diet dig-not dinner discuss disease divide doctor doll
    dozen draw-not dream-not drop-not due during-not eager effort empire employ encounter engine entertain envy
    equal escape essay evil exact examine exchange excuse exercise exist exit expense explode fabric factory
    fair famous fare farm fashion fever fiction figure file fine finish firm flavor flavour flood forget-not
    fortune forward frame freedom-not friend-not frighten furniture gallery gentleman glass-not govern government
    grateful gravity guest-not habit harm-not hospital hotel hungry-not hurry-not imagine imitate impossible
    increase industry inform injure innocent insect inside-not instant instead-not instrument insult insure
    intend invent invite island-not issue jolly journal joy judge juice kingdom-not knowledge-not language
    laugh-not lawyer lecture legal liberty library license limit liquid list-not local lodge lovely-not lucky-not
    major mark market material mayor meal-not medicine member mention message middle-not million mine-not minister
    mix modern moist moral motion mountain murder muscle mutual nation nephew nerve niece normal nuisance
    oblige observe obtain occupy ocean-not offend onion operate opinion oppose option orange organize original
    pack package palace panel parent park part-of partner passage patience pattern pause peculiar penny-not
    perform permit persuade photograph picnic piece pilot pipe plan plant-not plenty pocket poem-not poet-not
    polish polite pool-not popular port position possess possible post pour-not practical prefer prepare pretend
    prevent prime principal print private prize probable process produce profit progress project proper protect
    protest provide province pupil purple purpose pursue quality quantity quarrel quarter queen-not quote
    race-not radio rain-not raise-not range rapid rate raw-not ray razor reach-not ready-not recall recent
    recipe recognize record recover reduce refer reflect reform refuse regard region regret regular relate
    release relief rely remark remedy remove repair reply report represent request require rescue resemble
    reserve resign resist respect respond result retire reveal review reward ribbon rice ride-not rival
    route row-not rubber rural sail-not salad salary sample sauce scarf schedule scissors scratch-not screen
    seal seat-not section secure select senate sentence separate series settle several severe shade-not sheet-not
    shield-not shock-not signal silk silver-not similar single sink-not site situation size skill-not slight-not
    soup source space spare special species spectacle speech-not sphere spoil sport spot spring-not stamp
    standard station statue stomach-not strain strict stress strike-not structure student style subject substance
    succeed success sudden suggest suit summary supply support suppose surface surround survive suspect
    sustain symptom talent tax temper temple tension term test text-not theater-not ticket title toast-not
    tour tourist trace track-not trade-not tradition traffic train transfer translate trap-not tray treat
    treaty trial tribe trick trip triumph truck-not tube tune tunnel twist-not type uncle unite universe
    unusual upper-not urge usual vacation vague valley valuable vary vehicle venture version vessel victim
    video violent virgin vision visible vital vote vow-not wage-not waiter-not warrant-not wave-not weigh-not
    zone-not`.replace(/\S+-not/g, ""),

  germanic: `the a an and but or nor for so yet if then than that this these those there here where when while what
    which who whom whose why how i me my mine myself you your yours yourself he him his himself she her hers herself
    it its itself we us our ours ourselves am is are was were be been being have has had having do does did done
    doing will would shall should can could may might must ought not no yes yea of to in on at by with from up down
    out off over under again further once all any both each few more most other some such own only too until about
    above below between through during before after into onto upon within without along among around against
    toward towards behind beside beyond near far now ever never always often soon still also
    man woman men women child children boy girl son daughter mother father brother sister wife friend folk home
    house door floor roof wall room bed hand arm foot feet head hair eye eyes ear ears nose mouth lip lips tongue tooth
    teeth chin neck shoulder back chest heart hearts blood bone bones body finger fingers thumb knee elbow breath
    life death dead live lives love loved hate hope fear sad glad mad bad good better best worse worst old young new
    long short high deep wide broad narrow thin thick fat lean strong hard soft sweet sour bitter warm cold hot cool
    dry wet clean bright dark light night nights day days week weeks month year years morning evening noon sun moon
    star stars cloud clouds rain snow wind storm thunder frost ice fire water earth land sea river-not lake-not
    stream pond hill valley-not wood woods tree trees leaf leaves branch-not grass seed meat fish bird birds
    horse cow sheep pig dog cat wolf bear deer fox hare mouse fly bee worm snake eagle crow raven swan goose hen
    cock bull ox calf lamb fowl hound steed
    go goes going gone went come comes coming came get got give gave given make makes made making see saw seen look
    looked hear heard listen know knew known think thought feel felt say said tell told speak spoke spoken talk
    ask answer want wanted need needed find found keep kept let put set sit sat stand stood lie lay run ran walk
    jump fall fell fallen rise rose risen climb swim fly flew sing sang sung song songs dance-not play played work
    sleep slept dream dreams wake woke eat ate eaten drink drank bite chew taste smell hold held carry-not bring brought
    send sent write wrote written read learn teach taught begin began begun start end open shut bend break broke
    broken cut burn build built grow grew grown bear bore born beat bind bound blow blew bleed breed buy bought choose
    chose cling creep dig draw-not drive drove driven fight fought flee forget forgot forgive freeze froze hang hung
    hide hid hit lead led leave left lend lent lose lost mean meant meet met pay-not ride rode ring rang rung seek sought
    sell sold shake shook shine shone shoot shot sink sank slide slid spend spent spin spit split spread spring sprang
    steal stole stick stuck sting stung strike struck swear swore sweep swept swing swung tear tore wish wait watch
    help fill follow fetch wander wonder wander cry-not stay-not turn-not
    thing things way ways word words name names time times world work-not fire-not king queen-not lord lady
    god gods heaven hell ghost soul spirit-not truth faith-not
    one two three four five six seven eight nine ten hundred thousand first second-not third twenty thirty forty fifty
    like amaze amazed amazing yeah oh la na gonna wanna gotta ain't ya yo hey
    black white red blue green yellow brown grey gray gold silver-not
    big small little great whole half full empty free
    side sides place-not top bottom middle-not end ends edge
    well ill-not much many less least lot lots enough ago away
    again together alone apart ahead
    ground floor-not road path way-not street-not
    ship boat sail-not sword shield spear arrow bow
    bread milk butter-not cheese-not honey salt
    stone stones iron steel-not sand dust mud
    friend friends enemy-not foe
    sorry sorrow lonely lovely
    beneath beyond whisper whispers shadow shadows
    dawn dusk twilight
    under-not
    amazing-not grace-not wretch wretched lost found blind see
    hear
    bright brighter softly slowly quickly
    kiss kisses hug-not smile-not laugh laughed tears tear
    ever-not forever whenever wherever whatever
    anything everything nothing something anyone everyone someone nobody somebody anywhere everywhere nowhere
    somewhere sometimes
    maybe
    already
    being-not
    over-not
    tonight today tomorrow yesterday
    mine-not
    lonesome
    brave-not
    sweetheart
    baby-not
    storm-not
    drown drowned
    flame-not
    shine-not
    flood-not
    rock-not
    roll rolled
    shout shouted
    scream screamed
    sleep-not
    chase-not
    swim-not
    wild
    fool-not
    fight-not
    spirit-not
    winter summer spring-not autumn-not
    south north east west
    glow
    tonight-not
    fair-not
    blessed bless
    grave-not
    mind
    mine-not
    ruin-not
    sound-not
    bury buried
    burn-not
    bone-not
    free-not
    heal
    cheer
    bold
    bell bells
    moan
    ring-not
    sigh
    trouble-not
    weep wept
    wound
    yearn
    youth
    cloud-not
    dream-not
    ghost-not
    hunger
    thirst
    thorn
    tide
    wave
    wide-not
    wing-not
    wolf-not
    wrath
    yard
    yes-not`
};

// Build lookup: word -> category (first listed category wins).
const LEXICON = (() => {
  const map = new Map();
  for (const [cat, text] of Object.entries(LEXICON_SOURCES)) {
    for (const raw of text.split(/\s+/)) {
      const w = raw.trim().toLowerCase();
      if (!w || w.endsWith("-not") || map.has(w)) continue;
      map.set(w, cat);
    }
  }
  return map;
})();

if (typeof module !== "undefined") module.exports = { LEXICON };
