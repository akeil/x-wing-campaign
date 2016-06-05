/*
 * Model classes used on server and client side.
 *
 * - User
 * - Campaign
 * - Mission (static data)
 * - Pilot
 * - Ship (static data)
 *
 * Each model can be created by passing a dictionary of properties
 * to the factory functioin:
 * ```
 * var instance = NewModel({
 *        foo: "some-value",
 *        bar: "some-other-value"
 *    });
 * ```
 * The idea is to create model instances from the result of a database query
 * or REST+JSON Webservice call.
 *
 * Model classes should have a `validate()` method which raises an error if
 * any property is invalid.
 */
var errors = require('../common/errors');


// Constants ------------------------------------------------------------------


// reasons for earning XP
var KIND_DAMAGE     = "damage";
var KIND_KILL       = "kill";
var KIND_ASSIST     = "assist";
var KIND_GUARD      = "guard";
var KIND_MISSION    = "mission";

// reasons for spending XP
var KIND_SKILL_INCREASE = "skillIncrease";
var KIND_UPGRADE        = "upgrade";
var KIND_SHIP_CHANGE    = "shipChange";
var KIND_TALENT_CHANGE  = "talent";
var KIND_ABILITY_CHANGE = "ability";

var BASE_SKILL = 2;
var SHIP_CHANGE_COST = 5;

var SLOT_ASTROMECH          = 'Astromech';
var SLOT_BOMB               = 'Bomb';
var SLOT_CANNON             = 'Cannon';
var SLOT_CARGO              = 'Cargo';
var SLOT_CREW               = 'Crew';
var SLOT_ELITE              = 'Elite';
var SLOT_HARDPOINT          = 'Hardpoint';
var SLOT_ILLICIT            = 'Illicit';
var SLOT_MODIFICATION       = 'Modification';
var SLOT_MISSILE            = 'Missile';
var SLOT_SALVAGED_ASTROMECH = 'Salvaged Astromech';
var SLOT_SYSTEM             = 'System';
var SLOT_TEAM               = 'Team';
var SLOT_TECH               = 'Tech';
var SLOT_TITLE              = 'Title';
var SLOT_TORPEDO            = 'Torpedo';
var SLOT_TURRET             = 'Turret';


// User -----------------------------------------------------------------------


User = function(props) {
    props = props || {};
    this._id = props._id || null;
    this.name = props.name || null;
    this.displayName = props.displayName || null;

    this.pwHash = props.pwHash || null;
};

User.prototype.validate = function(){
    if(!this.name){
        throw errors.invalid('Username must be set');
    }

    if(!this.displayName){
        throw errors.invalid('Display name must be set');
    }
};

module.exports.NewUser = function(props){
    return new User(props);
};

// Campaign -------------------------------------------------------------------


/*
 * The campaign object tracks the state of an individual campaign,
 * e.g. which missions were played and their results.
 *
 * owner: the username of the campaign master
 *
 * playedMissions: [
 *   {
       name: <name>,
       status: VICTORY, DEFEAT
       rebelVP: <n>,
       imperialVP: <n>
     }
 * ]
 *
 * missionDeck: [
 *   <name>, <name>, <name>
 * ]
 */
Campaign = function(props) {
    props = props || {};
    this._id = props._id || null;
    this.owner = props.owner || null;
    this.displayName = props.displayName || null;
    this.missionDeck = props.missionDeck || [];
    this.playedMissions = props.playedMissions || [];
};

Campaign.prototype.patch = function(props){
    props = props || {};
    this.owner = props.owner || this.owner;
    this.displayName = props.displayName || this.displayName;
    this.missionDeck = props.missionDeck || this.missionDeck;
    this.playedMissions = props.playedMissions || this.playedMissions;
};

Campaign.prototype.validate = function(){
    if(!this.owner){
        throw errors.invalid('Owner must be set');
    }

    if(!this.displayName){
        throw errors.invalid('Display name must be set');
    }
};

/*
 * Add the given `missionName` to the `missionDeck`.
 */
Campaign.prototype.unlockMission = function(missionName){
    // TODO: check if not already in deck
    this.missionDeck.push(missionName);
};

/*
 * Remove the given `missionName` from the `missionDeck`.
 */
Campaign.prototype.removeMission = function(missionName){
    var indexToRemove = -1;
    for (var i = 0; i < this.missionDeck.length; i++) {
        if(this.missionDeck[i] === missionName){
            indexToRemove = i;
            break;
        }
    }
    if(indexToRemove >= 0){
        this.missionDeck.splice(indexToRemove, 1);
    }
};

/*
 * Get he name of the last played mission.
 */
Campaign.prototype.currentMission = function(){
    if(this.playedMssions){
        return this.playedMssions[this.playedMssions.length -1].name;
    }else{
        return null;
    }
};

/*
 * Calculate and apply the effects of a played mission.
 * This means:
 *
 * - determine victory points for both sides
 * - determine if a new mission becomes unlocked
 *   and add it to the mission deck.
 * - remove the played mission from the mission deck
 * - add the given mission to the list of `playedMssions`
 *
 * mission: a `Mission` object
 * victory: true | false
 */
Campaign.prototype.missionAftermath = function(mission, victory){
    // TODO: check if actually in missionDeck
    var status = victory ? 'Victory' : 'Defeat';
    var rebelVP, imperialVP;
    if(victory){
        rebelVP = mission.rebelVP;
        imperialVP = 0;
        this.removeMission(mission.name);

        if(mission.unlockOnVictory){
            this.unlockMission(mission.unlockOnVictory);
        }

    }else{
        rebelVP = 0;
        imperialVP = mission.imperialVP;
        if(!mission.replayOnDefeat){
            this.removeMission(mission.name);
        }

        if(mission.unlockOnDefeat){
            this.unlockMission(mission.unlockOnDefeat);
        }
    }

    this.playedMissions.push({
        name: mission.name,
        status: status,
        rebelVP: rebelVP,
        imperialVP: imperialVP
    });

};

/*
 * Calculate the toal victory points for the rebel side
 * from the results of played missions.
 */
Campaign.prototype.totalRebelVP = function(){
    var result = 0;
    for (var i = 0; i < this.playedMissions.length; i++) {
        if(this.playedMissions[i].rebelVP){
            result += this.playedMissions[i].rebelVP;
        }
    }
    return result;
};

/*
 * Calculate the toal victory points for the imperial side
 * from the results of played missions.
 */
Campaign.prototype.totalImperialVP = function(){
    var result = 0;
    for (var i = 0; i < this.playedMissions.length; i++) {
        if(this.playedMissions[i].imperialVP){
            result += this.playedMissions[i].imperialVP;
        }
    }
    return result;
};

/*
 * Determine the victory status for the rebel side
 * from the victory point totals.
 */
Campaign.prototype.victoryStatus = function(){
    var score = this.totalRebelVP() - this.totalImperialVP();
    if(score < 0){
        return 'Defeat';
    }else if(score > 0){
        return 'Victory';
    }else{
        return 'Draw';
    }
};

module.exports.NewCampaign = function(props){
    return new Campaign(props);
};

// Mission --------------------------------------------------------------------


/*
 * A Mission object contains information about a single mission
 * from static data.
 */
Mission = function(props){
    props = props || {};
    this.name = props.name || null;
    this.displayName = props.displayName || null;
    this.storyArc = props.storyArc || null;
    this.startingMission = props.startingMission || false;
    this.warmup = props.warmup || false;
    this.territory = props.territory || null;
    this.replayOnDefeat = props.replayOnDefeat || false;
    this.unlockOnVictory = props.unlockOnVictory || null;
    this.unlockOnDefeat = props.unlockOnDefeat || null;
    this.rebelVP = props.rebelVP || 0;
    this.imperialVP = props.imperialVP || 0;
    this.info = props.info || null;
};

module.exports.NewMission = function(props){
    return new Mission(props);
};


// Pilot ----------------------------------------------------------------------

/*
 * A pilot represents a single play (=`User`) in a campaign (although it is
 * possible for a user to own multiple pilots in the same campaign).
 *
 * The pilot object is used to track the development of the pilot during
 * the campaign such as:
 *
 * - XP earned
 * - XP spent
 * - current ship
 * - upgrade cars (TBD)
 *
 * owner: name of owning user
 * ship: name of current ship
 */
Pilot = function(props) {
    props = props || {};
    this._id = props._id || null;
    this.campaignid = props.campaignid || null;
    this.owner = props.owner || null;
    this.ship = props.ship || null;
    this.callsign = props.callsign || null;

    /*
     * Expected:
     * [
     *   {
     *     mission: <mission-name>,
     *     xp: <value>,
     *     kills: {
     *        'tie-figther': 2,
     *        'tie-interceptor': 2,
     *        ...
     *     }
     *   }
     * ]
     */
    this.playedMissions = props.playedMissions || [];

    this.spentXP = props.spentXP || [];
};

Pilot.prototype.patch = function(props){
    props = props || {};
    this.campaignid = props.campaignid || this.campaignid;
    this.owner = props.owner || this.owner;
    this.ship = props.ship || this.ship;
    this.callsign = props.callsign || this.callsign;
    this.playedMissions = props.playedMissions || this.playedMissions;
    this.spentXP = props.spentXP || this.spentXP;
};

Pilot.prototype.validate = function(){
    if(!this.campaignid){
        throw errors.invalid('Campaign must be set');
    }
    if(!this.owner){
        throw errors.invalid('Owner must be set');
    }
    if(!this.callsign){
        throw errors.invalid('Callsign must be set');
    }

};

/*
 * Get the number of earned XP either for a mission if `missionName` is set
 * or for all missions if no `missionName` is given.
 */
Pilot.prototype.totalEarnedXP = function(missionName){
    var allMissions = !missionName;
    var total = 0;
    for(var i=0; i < this.playedMissions.length; i++){
        if(allMissions || missionName === this.playedMissions[i].mission){
            total += this.playedMissions[i].xp || 0;
            if(!allMissions){
                return total;
            }
        }
    }
    return total;
};

Pilot.prototype.totalSpentXP = function(){
    var total = 0;
    for(var i=0; i < this.spentXP.length; i++){
        total += this.spentXP[i].xp || 0;
    }
    return total;
};

Pilot.prototype.currentXP = function(){
    return this.totalEarnedXP() - this.totalSpentXP();
};

Pilot.prototype.missionAftermath = function(missionName, xp, kills){
    for (var i = 0; i < this.playedMissions.length; i++) {
        if(this.playedMissions[i].mission === missionName){
            this.playedMissions[i].xp = xp || 0;
            this.playedMissions[i].kills = kills || 0;
            return;
        }
    }
    // mission not yet recorded
    this.playedMissions.push({
        mission: missionName,
        xp: xp,
        kills: kills
    });
};

Pilot.prototype.spendXP = function(missionName, kind, xp){
    this.spentXP.push({
        mission: missionName,
        kind: kind,
        xp: xp
    });
    // TODO: group/sum and re-sort
};

Pilot.prototype.skill = function(){
    var result = BASE_SKILL;
    for(var i=0; i < this.spentXP.length; i++){
        if(this.spentXP[i] === KIND_SKILL_INCREASE){
          result += 1;
        }
    }
    return result;
};

Pilot.prototype.upgrades = function(){
    result = [];
    for(var i=0; i < this.spentXP.length; i++){
        if(this.spentXP[i].kind === KIND_UPGRADE){
            // TODO: check if not lost
            upgrades.push(this.spentXP[i]);
        }
    }
    return result;
};

Pilot.prototype.talents = function(){
    result = [];
    for(var i=0; i < this.spentXP.length; i++){
        if(this.spentXP[i].kind === KIND_TALENT){
            result.push(this.spentXP[i]);
        }
    }
    return result;
};

Pilot.prototype.abilities = function(){
    result = [];
    for(var i=0; i < this.spentXP.length; i++){
        if(this.spentXP[i].kind === KIND_ABILITY){
            result.push(this.spentXP[i]);
        }
    }
    return result;
};

Pilot.prototype.changeShip = function(mission, ship){
    var availableXP = this.currentXP();
    if(availableXP < SHIP_CHANGE_COST){
        throw errors.conflict('Insufficient XP');
    }

    if(ship.requiredSkill > this.skill()){
        throw errors.conflict('Required skill level not met');
    }

    this.spendXP(mission, KIND_SHIP_CHANGE, SHIP_CHANGE_COST);
    this.ship = ship.name;
};

Pilot.prototype.increaseSkill = function(mission){
    var availableXP = this.currentXP();
    var currentSkill = this.skill();
    var cost = (currentSkill + 1) * 2;

    if(availableXP < cost){
        throw "InsufficientXP";
    }
    this.spendXP(mission, KIND_SKILL_INCREASE, cost);
};

Pilot.prototype.addUpgrade = function(mission, upgradeCard){
    var availableXP = this.currentXP();
    if(availableXP < upgradeCard.value){
        throw "InsufficientXP";
    }
    // TODO: store which card we have added
    this.spendXP(mission, KIND_UPGRADE, upgradeCard.value);
};

// Tell whether we would be able to equip the given upgrade
Pilot.prototype.checkUpgrade = function(upgradeCard){
    // TODO: check ship for slot
    return true;
};

Pilot.prototype.addTalent = function(mission, TODO){
    var availableXP = this.currentXP();
    cost = 99999;
    if(availableXP < cost){
        throw "InsufficientXP";
    }
    // TODO: store which talent we have added
    this.spendXP(mission, KIND_TALENT, cost);
};

Pilot.prototype.addAbility = function(mission, upgradeCard){
    var availableXP = this.currentXP();
    cost = 99999;
    if(availableXP < cost){
        throw "InsufficientXP";
    }
    // TODO: store which ability we have added
    this.spendXP(mission, KIND_ABILITY, cost);
};

module.exports.NewPilot = function(props){
    return new Pilot(props);
};


// Ship -----------------------------------------------------------------------


/*
 * slots:
 * a map of requiredSkill => ArrayOfSlots
 *
 * e.g.
 * {
 *  1: ['Bomb', 'Turret'],
 *  3: ['Elite'],
 *  4: ['Torpedo']
 * }
 */
Ship = function(props) {
    props = props || {};
    this._id = props._id || null;
    this.name = props.name || null;
    this.displayName = props.displayName || null;
    this.requiredSkill = props.requiredSkill || null;

    this.slots = props.slots || {};
};

module.exports.NewShip = function(props){
    return new Ship(props);
};


module.exports.enemyShips = [
    {
        name: 'tie-figther',
        displayName: 'Tie Fighter'
    },
    {
        name: 'tie-interceptor',
        displayName: 'Tie Interceptor'
    }
];
