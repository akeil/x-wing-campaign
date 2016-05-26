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
    this.name = props.name || null;

};


module.exports.User = User;


// Campaign -------------------------------------------------------------------


Campaign = function(props) {
    props = props || {};
    this.id = props.id || null;
    this.name = props.name || null;
    this.owner = props.owner || null;
};


// Pilot ----------------------------------------------------------------------


Pilot = function(props) {
    props = props || {};
    this.id = props.id || null;
    this.campaign = props.campaign || null;
    this.owner = props.owner || null;
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
    if(this.campaign === null){
        throw "ValidationError";
    }
    if(this.owner === null){
        throw "ValidationError";
    }
    if(this.callsign === null){
        throw "ValidationError";
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
