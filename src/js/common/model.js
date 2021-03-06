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

var BASE_SKILL          = 2;
var SHIP_CHANGE_COST    = 5;
var SHIP_CHANGE_MIN_SKILL = 4;

var STATUS_VICTORY = 'Victory';
var STATUS_DEFEAT  = 'Defeat';

var SLOT_ASTROMECH          = 'astromech';
var SLOT_BOMB               = 'bomb';
var SLOT_CANNON             = 'cannon';
var SLOT_CARGO              = 'cargo';
var SLOT_CREW               = 'crew';
var SLOT_ELITE              = 'elite';
var SLOT_HARDPOINT          = 'hardpoint';
var SLOT_ILLICIT            = 'illicit';
var SLOT_MISSILE            = 'missile';
var SLOT_MODIFICATION       = 'modification';
var SLOT_SALVAGED_ASTROMECH = 'salvaged-astromech';
var SLOT_SYSTEM             = 'system';
var SLOT_TEAM               = 'team';
var SLOT_TECH               = 'tech';
var SLOT_TITLE              = 'title';
var SLOT_TORPEDO            = 'torpedo';
var SLOT_TURRET             = 'turret';

module.exports.SLOTS = [
    SLOT_ASTROMECH,
    SLOT_BOMB,
    SLOT_CANNON,
    SLOT_CARGO,
    SLOT_CREW,
    SLOT_ELITE,
    SLOT_HARDPOINT,
    SLOT_ILLICIT,
    SLOT_MODIFICATION,
    SLOT_SALVAGED_ASTROMECH,
    SLOT_SYSTEM,
    SLOT_TEAM,
    SLOT_TECH,
    SLOT_TITLE,
    SLOT_TORPEDO,
    SLOT_TURRET
];


// Helpers --------------------------------------------------------------------


var getXP = function(item){
    return item.xp || 0;
};


var add = function(total, value){
    return total + value;
};


var count = function(total, value){
    return total + 1;
};


// User -----------------------------------------------------------------------


User = function(props) {
    props = props || {};
    this._id = props._id || null;
    this.version = props.version || 0;
    this.lastModified = props.lastModified || null;
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
    if(!this.version || this.version === null){
        throw errors.invalid('Version field must be set');
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
    this.version = props.version || 0;
    this.lastModified = props.lastModified || null;
    this.owner = props.owner || null;
    this.displayName = props.displayName || null;
    this.missionDeck = props.missionDeck || [];
    this.playedMissions = props.playedMissions || [];
};

Campaign.prototype.patch = function(props){
    props = props || {};
    this.version = props.version;
    this.lastModified = props.lastModified || this.lastModified;
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
    if(!this.version && this.version !== 0){
        throw errors.invalid('Version field must be set');
    }
};

/*
 * Add the given `missionName` to the `missionDeck`.
 * Does nothing if the mission is already in the deck.
 */
Campaign.prototype.unlockMission = function(missionName){
    if(this.missionDeck.indexOf(missionName) < 0){
        this.missionDeck.push(missionName);
    }
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
    if(this.playedMissions && this.playedMissions.length > 0){
        return this.playedMissions[this.playedMissions.length -1].name;
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
 * - add the given mission to the list of `playedMissions`
 *
 * mission: a `Mission` object
 * victory: true | false
 */
Campaign.prototype.missionAftermath = function(mission, victory){
    // TODO: check if actually in missionDeck
    var status = victory ? STATUS_VICTORY : STATUS_DEFEAT;
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
 * Undo the mission aftermath for the given `Mission`.
 * Remove this mission from list of played missions and place it back
 * in the mission deck.
 */
Campaign.prototype.undoMissionAftermath = function(mission){
    var indexToRemove = -1;
    for (var i = 0; i < this.playedMissions.length; i++) {
        if(this.playedMissions[i].name === mission.name){
            indexToRemove = i;
            break;
        }
    }
    if(indexToRemove < 0){
        throw errors.conflict('Mission was not played.');
    }

    // remove missions unlocked by this mission
    var status = this.playedMissions[indexToRemove].status;
    if(status === STATUS_VICTORY){
        if(mission.unlockOnVictory){
            this.removeMission(mission.unlockOnVictory);
        }
    }else if(status === STATUS_DEFEAT){
        if(mission.unlockOnDefeat){
            this.removeMission(mission.unlockOnDefeat);
        }
    }

    // remove from playedMissions
    this.playedMissions.splice(indexToRemove, 1);
    // add back to mission deck unless it's already in there
    // is mission was lost and is `replayOnDefeat` it is still in the deck
    this.unlockMission(mission.name);
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
        return STATUS_DEFEAT;
    }else if(score > 0){
        return STATUS_VICTORY;
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
    this.version = props.version || 0;
    this.lastModified = props.lastModified || null;
    this.displayName = props.displayName || null;
    this.storyArc = props.storyArc || null;
    this.startingMission = props.startingMission ? true : false;
    this.warmup = props.warmup ? true : false;
    this.territory = props.territory || null;
    this.replayOnDefeat = props.replayOnDefeat ? true : false;
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
    this.version = props.version || 0;
    this.lastModified = props.lastModified || null;
    this.campaignid = props.campaignid || null;
    this.owner = props.owner || null;
    this.ship = props.ship || null;
    this.callsign = props.callsign || null;
    this.initialXP = props.initialXP || 0;
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
    /*
     * Expected:
     * [
     *   {
     *     mission: <mission-name>,
     *     kind: <enum>,
     *     value: <name>,
     *     xp: <n>,
     *     displayName: <text-to-display>
     *   },
     *   {...}
     * ]
     */
    this.spentXP = props.spentXP || [];
};

Pilot.prototype.patch = function(props){
    props = props || {};
    this.version = props.version;
    this.lastModified = props.lastModified || this.lastModified;
    this.campaignid = props.campaignid || this.campaignid;
    this.owner = props.owner || this.owner;
    this.ship = props.ship || this.ship;
    this.callsign = props.callsign || this.callsign;
    this.initialXP = props.initialXP || this.initialXP;
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
    if(!this.ship){
        throw errors.invalid('Ship must be set');
    }
    if(!this.version && this.version !== 0){
        throw errors.invalid('Version field must be set');
    }
};

/*
 * Get the number of earned XP either for a mission if `missionName` is set
 * or for all missions if no `missionName` is given.
 */
Pilot.prototype.totalEarnedXP = function(missionName){
    var allMissions = !missionName;
    return this.playedMissions
        .filter(function(item){
            return allMissions || missionName === item.mission;
        })
        .map(getXP)
        .reduce(add, 0);
};

/*
 * Get the total amount of spent XP
 */
Pilot.prototype.totalSpentXP = function(){
    return this.spentXP
        .map(getXP)
        .reduce(add, 0);
};

/*
 * Get the current amount of unspent XP for this pilot.
 */
Pilot.prototype.currentXP = function(){
    return this.initialXP + this.totalEarnedXP() - this.totalSpentXP();
};

/*
 * Do mission aftermath for this pilot on the given mission name.
 *
 * Params:
 * `missionName`
 * `xp`: the number of XP earned in this mission
 * `kills`: number of killy ba enemy ship type
 */
Pilot.prototype.missionAftermath = function(missionName, xp, kills){
    for (var i = 0; i < this.playedMissions.length; i++) {
        if(this.playedMissions[i].mission === missionName){
            // update existing record
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

/*
 * Buy the given `Upgrade` for this pilot.
 */
Pilot.prototype.buyUpgrade = function(missionName, upgrade){
    if(this.currentXP() < upgrade.cost){
        throw errors.conflict('Insufficient XP');
    }
    // TODO: check available slots on ship?
    this.spendXP(missionName,
                 KIND_UPGRADE,
                 upgrade.name,
                 upgrade.cost,
                 upgrade.displayName);
};

Pilot.prototype.spendXP = function(missionName, kind, value, xp, displayName){
    this.spentXP.push({
        mission: missionName,
        kind: kind,
        value: value,
        xp: xp,
        displayName: displayName
    });
    this.spentXP.sort(function(one, other){
        // TODO: sort by order of missions played, then kind, then cost
        return 0;
    });
};

/*
 * Get the current pilot skill for this pilot.
 */
Pilot.prototype.skill = function(){
    return this.spentXP.filter(function(item){
        return item.kind === KIND_SKILL_INCREASE;
    }).reduce(count, BASE_SKILL);
};

/*
 * Get a list of bought upgrades for this pilot.
 */
Pilot.prototype.upgrades = function(){
    return this.spentXP.filter(function(item){
        return item.kind == KIND_UPGRADE;
    });
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

/*
 * Change this pilot's ship to the given `Ship`.
 *
 * Params
 * missionName: the name of the currrent mission
 * ship: a `Ship` object
 *
 */
Pilot.prototype.changeShip = function(missionName, ship){
    var availableXP = this.currentXP();
    if(availableXP < SHIP_CHANGE_COST){
        throw errors.conflict('Insufficient XP');
    }

    var currentSkill = this.skill();
    if(currentSkill < SHIP_CHANGE_MIN_SKILL){
        throw errors.conflict('Required skill level for ship change not met');
    }
    if(ship.requiredSkill > currentSkill){
        throw errors.conflict('Required skill level not met');
    }

    this.spendXP(missionName,
                 KIND_SHIP_CHANGE,
                 ship.name,
                 SHIP_CHANGE_COST,
                 ship.displayName);
    this.ship = ship.name;
};

/*
 * Increase the pilot skill by the given value.
 */
Pilot.prototype.increaseSkill = function(missionName, increaseBy){
    if(increaseBy <= 0){
        throw errors.invalid('Invalid pilot skill');
    }
    var availableXP = this.currentXP();
    var currentSkill = this.skill();
    // skill increase costs new skill level x2
    // for each increase
    // e.g. from 2 => 4 costs 3x2 + 4x2 = 14
    // we record costs for individual steps
    var costs = [];
    for(var i=0; i<increaseBy; i++){
        costs.push((currentSkill + 1) * 2);
        currentSkill++;
    }
    var totalCost = costs.reduce(add);
    if(availableXP < totalCost){
        throw errors.conflict("Insufficient XP");
    }
    // create one entry per increase
    for(var j=0; j<costs.length; j++){
        this.spendXP(missionName,
                     KIND_SKILL_INCREASE,
                     increaseBy,
                     costs[j],
                     'Pilot Skill +1');
    }
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
        throw errors.conflict("Insufficient XP");
    }
    // TODO: store which talent we have added
    //this.spendXP(mission, KIND_TALENT, cost);
};

Pilot.prototype.addAbility = function(mission, upgradeCard){
    var availableXP = this.currentXP();
    cost = 99999;
    if(availableXP < cost){
        throw errors.conflict("Insufficient XP");
    }
    // TODO: store which ability we have added
    //this.spendXP(mission, KIND_ABILITY, cost);
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
    this.version = props.version || 0;
    this.lastModified = props.lastModified || null;
    this.name = props.name || null;
    this.displayName = props.displayName || null;
    this.requiredSkill = props.requiredSkill || null;
    this.startingShip = props.startingShip ? true : false;
    this.initialXP = props.initialXP || 0;
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


// Upgrades -------------------------------------------------------------------


Upgrade = function(props){
    props = props || {};
    this._id = props._id || null;
    this.version = props.version || 0;
    this.lastModified = props.lastModified || null;
    this.name = props.name || null;
    this.displayName = props.displayName || null;
    this.slot = props.slot || null;
    this.cost = props.cost || null;
    this.description = props.description || null;
    this.unique = props.unique ? true : false;
};

module.exports.NewUpgrade = function(props){
    return new Upgrade(props);
};
