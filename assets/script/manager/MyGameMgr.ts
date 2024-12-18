import { _decorator, Component, Mesh, MeshRenderer, Node, Vec3 } from 'cc';
import { GameMgr } from '../library/manager/GameMgr';
import { PlayerController } from '../controller/PlayerController';
import { PayZone } from '../library/controller/PayZone';
import { WorkZone } from '../controller/WorkZone';
import { GameState, GameStateMgr } from '../library/GameState';
import { GhostMgr } from './GhostMgr';
import { FrozenAssistantMgr } from './FrozenAssistantMgr';
const { ccclass, property } = _decorator;

@ccclass('MyGameMgr')
export class MyGameMgr extends GameMgr {
    @property(PlayerController)
    player:PlayerController = null;

    @property(PayZone)
    payZones:PayZone[] = [];

    @property(WorkZone)
    workZones:WorkZone[] = [];

    @property(Node)
    moneyGroup:Node[] = [];

    @property(Node)
    inputGroup:Node[] = [];

    @property(Node)
    inputPosGroup:Node[] = [];

    @property(Node)
    fieldPos:Node = null;

    @property(Node)
    packShotMgr:Node = null;

    @property(FrozenAssistantMgr)
    frozenMgr:FrozenAssistantMgr = null;

    @property(GhostMgr)
    ghostMgr:GhostMgr = null;

    @property(WorkZone)
    assistantZones:WorkZone[] = [];

    @property(Node)
    nextLevelTutorPos:Node = null;

    protected _tutorTargetNodeHistory:Node[] = [];
    protected _timer:number = 0;
    protected _fieldPosTimer:number = 0;
    protected _isFirstField:boolean = true;
    protected _firstFieldTutor:boolean = true;

    protected _arrowMeshRenderer:MeshRenderer = null;

    onLoad(): void {
        if (super.onLoad)
            super.onLoad();

        if (this.arrow)
            this._arrowMeshRenderer = this.arrow.getComponent(MeshRenderer);
    }

    start(): void {
        if (super.start)
            super.start();

        // this.setTutorPos(this.fieldPos, true, true);
        this.showTutor(false);
    }

    protected lateUpdate(dt: number): void {
        if (super.lateUpdate)
            super.lateUpdate(dt);

        this._timer += dt;

        if (this.player) {
            if (this.nextLevelTutorPos.activeInHierarchy) {
                this.setTutorPos(this.nextLevelTutorPos, true, false, false, 1, 0);
            } else {
                let done:boolean = false;

                const item = this.player.fetchItem(-1);
                if (item) {
                    for (let index = 0; index < this.workZones.length; index++) {
                        const element = this.workZones[index];
                        if (element && element.node.activeInHierarchy && element.workItemType == item.type) {
                            this.setTutorPos(element.node, false, true, false);
                            this._fieldPosTimer = 0;
                            done = true;
                            break;
                        }
                    }

                    if (!done && this.ghostMgr && !this.player.servedFood) {
                        this.setTutorPos(this.ghostMgr.findNearst(this.player.node), false, false, true);
                        this._fieldPosTimer = 0;
                        done = true;
                    }
                } else {
                    let needAssistantZone:Node = null;
                    for (let index = 0; index < this.assistantZones.length; index++) {
                        const element = this.assistantZones[index];
                        if (element && element.node.activeInHierarchy && element.isNeedAssistant()) {
                            needAssistantZone = element.node;
                            break;
                        }
                    }

                    if (this.player.hasFollowAssistant()) {
                        if (needAssistantZone) {
                            this.setTutorPos(needAssistantZone, false, true, false);
                            this._fieldPosTimer = 0;
                            done = true;
                        }
                    } else
                    if (this.frozenMgr) {
                        const frozen = this.frozenMgr.findNearst(this.player.node);
                        if (frozen) {
                            this.setTutorPos(frozen, false, false, true);
                            this._fieldPosTimer = 0;
                            done = true;
                        }
                    }
                    
                    if (!done) {
                        if (this.player.hasMoney()) {
                            for (let index = 0; index < this.payZones.length; index++) {
                                const element = this.payZones[index];
                                if (element && element.node.activeInHierarchy) {
                                    this.setTutorPos(element.node, false, false, false);
                                    this._fieldPosTimer = 0;
                                    done = true;
                                    break;
                                }
                            }
                        } else if ((this.moneyGroup.length && this.moneyGroup[0].children.length > 0)) {
                            this.setTutorPos(this.moneyGroup[0], false, false, true);
                            this._fieldPosTimer = 0;
                        } else {
                            for (let index = 0; index < this.inputGroup.length; index++) {
                                const element = this.inputGroup[index];                            
                                if (element.children.length > 0) {
                                    this.setTutorPos(this.inputPosGroup[index], false, false, element == this.inputPosGroup[index]);
                                    this._fieldPosTimer = 0;
                                    done = true;
                                    break;
                                }
                            }
                        }
                    }
                        
                    if (!done && this.fieldPos) {
                        this._fieldPosTimer += dt;
                        if (this._firstFieldTutor || this._fieldPosTimer > 0.7) {
                            this._firstFieldTutor = false;
                            this._fieldPosTimer = 0;
                            if (!this.player.isFollowing()) {
                                this.setTutorPos(this.player.findNearstAnimal(), this._isFirstField, false, false, 1, 0);
                                this._isFirstField = false;
                            }
                        }
                    }
                }
            }

            if (this.arrow.active) {
                const tutorDirection = GameMgr.getTutorialDirection(this.player.node.getWorldPosition());
                this.player.adjustTutorArrow(tutorDirection, dt);
            } else
                this.player.adjustTutorArrow(null, dt);
        }
    }

    protected setTutorPos(node:Node, followCamera:boolean, waitAction:boolean, considerChildren:boolean
        , materianIndex:number = 1, delay:number = 1) : Vec3 {
        const newPos = super.setTutorPos(node, followCamera, waitAction, considerChildren);

        if (newPos && this._arrowMeshRenderer) {
            this._arrowMeshRenderer.material = this._arrowMeshRenderer.materials[materianIndex];
        }
        
        if (followCamera && newPos && this.player && this._tutorTargetNodeHistory.indexOf(node) < 0) {
            if (waitAction && this._tutorTargetNodeHistory.length > 0)
                this.scheduleOnce(()=>{
                    this.player.setTutorTargetPos(newPos, 0);
                }, 0.5)
            else {
                if (delay > 0) {
                    this.scheduleOnce(()=>{
                        this.player.setTutorTargetPos(newPos, 0);
                    }, delay)
                } else
                    this.player.setTutorTargetPos(newPos, 0);
            }
            this._tutorTargetNodeHistory.push(node);
        }
        
        return newPos;
    }
}


