var errors = require('../common/errors');

// Constants ------------------------------------------------------------------


var KIND_DAMAGE = "damage";
var KIND_KILL = "kill";
var KIND_ASSIST = "assist";
var KIND_GUARD = "guard";
var KIND_MISSION = "mission";

var KIND_SKILL_INCREASE = "skillIncrease";
var KIND_UPGRADE = "upgrade";
var KIND_SHIP_CHANGE = "shipChange";
var KIND_TALENT_CHANGE = "talent";
var KIND_ABILITY_CHANGE = "ability";

var BASE_SKILL = 2;
var SHIP_CHANGE_COST = 5;


// User -----------------------------------------------------------------------


User = function(props) {
    props = props || {};
    this._id = props._id || null;
    this.name = props.name || null;
    this.displayName = props.displayName || null;
};

User.prototype.validate = function(){
    if(!this.name){
        throw errors.invalid('Username must be set');
    }

    if(!this.displayName){
        throw errors.invalid('Display name must be set');
    }
};

module.exports.User = User;


// Campaign -------------------------------------------------------------------

/*
 *  owner: the username of the campaign master
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

Campaign.prototype.validate = function(){
    if(!this.owner){
        throw errors.invalid('Owner must be set');
    }

    if(!this.displayName){
        throw errors.invalid('Display name must be set');
    }
};

Campaign.prototype.unlockMission = function(missionName){
    // TODO: check if not already in deck
    this.missionDeck.push(missionName);
};

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
 * mission: a Mission object
 // * victory: true | false
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
    }

    this.playedMissions.push({
        name: mission.name,
        status: status,
        rebelVP: rebelVP,
        imperialVP: imperialVP
    });

};

Campaign.prototype.totalRebelVP = function(){
    var result = 0;
    for (var i = 0; i < this.playedMissions.length; i++) {
        result += this.playedMissions[i].rebelVP;
    }
    return result;
};

Campaign.prototype.totalImperialVP = function(){
    var result = 0;
    for (var i = 0; i < this.playedMissions.length; i++) {
        result += this.playedMissions[i].imperialVP;
    }
    return result;
};

module.exports.Campaign = Campaign;


// Mission --------------------------------------------------------------------


Mission = function(props){
    props = props || {};
    this.name = props.name || null;
    this.displayName = props.displayName || null;
    this.storyArc = props.storyArc || null;
    this.warmup = props.warmup || false;
    this.territory = props.territory || null;
    this.replayOnDefeat = props.replayOnDefeat || false;
    this.unlockOnVictory = props.unlockOnVictory || null;
    this.rebelVP = props.rebelVP || 0;
    this.imperialVP = props.imperialVP || 0;
    this.info = props.info || null;
};

module.exports.Mission = Mission;


// Pilot ----------------------------------------------------------------------

/*
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

    this.kills = props.kills || [];

    /*
     * Expected:
     * [
     *   {
     *     mission: <v>,
     *     kind: <v>,
     *     value: <v>
     *   }
     * ]
     */
    this.earnedXP = props.earnedXP || [];

    this.spentXP = props.spentXP || [];
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

Pilot.prototype.totalEarnedXP = function(){
    var total = 0;
    for(var i=0; i < this.earnedXP.length; i++){
        total += this.earnedXP[i].value;
    }
    return total;
};

Pilot.prototype.totalSpentXP = function(){
    var total = 0;
    for(var i=0; i < this.spentXP.length; i++){
        total += this.spentXP[i].value;
    }
    return total;
};

Pilot.prototype.currentXP = function(){
    return this.totalEarnedXP() - this.totalSpentXP();
};

Pilot.prototype.earnXP = function(mission, kind, count){
    this.earnedXP.push({
        mission: mission,
        kind: kind,
        value: count
    });
    // TODO: group/sum and re-sort
};

Pilot.prototype.spendXP = function(mission, kind, count){
    this.spentXP.push({
        mission: mission,
        kind: kind,
        value: count
    });
    // TODO: group/sum and re-sort
};

Pilot.prototype.addKills = function(mission, shipType, count){
    // TODO: group/sum by mission + shipType
    this.kills.push({
        mission: mission,
        shipType: shipType,
        count: count
    });
};

Pilot.prototype.skill = function(){
    var result = BASE_SKILL;
    for(var i=0; i < this.earnedXP.length; i++){
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

Pilot.prototype.changeShip = function(mission, newShip){
    var availableXP = this.currentXP();
    if(availableXP < SHIP_CHANGE_COST){
        throw "InsufficientXP";
    }
    // TODO: check whether ship matches skill level
    // TODO: where/how do we store the new shipType
    this.spendXP(mission, KIND_SHIP_CHANGE, SHIP_CHANGE_COST);
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


module.exports.Pilot = Pilot;


// Ship -----------------------------------------------------------------------


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


module.exports.Ship = Ship;
