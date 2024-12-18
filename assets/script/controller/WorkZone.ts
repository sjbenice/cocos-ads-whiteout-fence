import { _decorator, CCString, Collider, Component, ITriggerEvent, Material, MeshRenderer, Node, Quat, randomRange, sys, tween, Tween, v3, Vec3 } from 'cc';
import { Utils } from '../library/util/Utils';
import { ParabolaTween } from '../library/util/ParabolaTween';
import { SoundMgr } from '../library/manager/SoundMgr';
import { PlayerController} from './PlayerController';
import { PHY_GROUP } from '../library/Layers';
import { Number3d } from '../library/ui/Number3d';
import { LevelUpController } from './LevelUpController';
const { ccclass, property } = _decorator;

@ccclass('WorkZone')
export class WorkZone extends Component {
    @property
    workerType:number = 0;

    @property
    workItemType:number = 0;

    @property
    allAcceptable:boolean = false;

    @property
    isScaleOutline:boolean = false;

    @property
    isBlinkOutline:boolean = true;

    @property(Node)
    outlines:Node[] = [];

    @property(Collider)
    collider:Collider = null;

    @property
    dropInterval: number = 100; // Interval in milliseconds

    @property(Node)
    placePos:Node = null;

    @property
    placeParabola:boolean = false;
    
    @property(CCString)
    itemSound:string = '';

    @property(Node)
    assistant:Node = null;

    @property
    totalAssistantCount:number = 3;

    @property(Number3d)
    curAssistantCount3d:Number3d = null;

    @property(Node)
    activeNodes:Node[] = [];

    @property(Material)
    progressMaterial:Material = null;

    private _dropTimers: number[] = [];
    private _isDropping:boolean = false;
    private _players:PlayerController[] = [];

    private _tempPos:Vec3 = Vec3.ZERO.clone();

    protected _outlineOrgScale:Vec3 = null;
    protected _outlineBlinkScale:Vec3 = null;
    protected _placeHalfDimention:Vec3 = null;

    protected _hasPlayer:boolean = true;// for first time blink outline

    protected _progressTimer:number = 0;
    protected _progressNumber:number = 0;

    start() {
        if (this.outlines.length > 0) {
            this._outlineOrgScale = this.outlines[0].scale.clone();
            this._outlineBlinkScale = this._outlineOrgScale.clone();
            this._outlineBlinkScale.x *= 1.1;
            this._outlineBlinkScale.z *= 1.1;

            this.blinkOutline(true);
        }

        this._placeHalfDimention = Utils.calcArrangeDimension(this.placePos);

        if (!this.collider)
            this.collider = this.getComponent(Collider);

        if (this.collider) {
            this.collider.on('onTriggerEnter', this.onTriggerEnter, this);
            this.collider.on('onTriggerExit', this.onTriggerExit, this);
        }
    }
    
    onDestroy() {
        if (this.collider) {
            this.collider.off('onTriggerEnter', this.onTriggerEnter, this);
            this.collider.off('onTriggerExit', this.onTriggerExit, this);
        }
    }

    public static getGuestFromColliderEvent(otherCollider:Collider) : PlayerController {
        if (otherCollider && otherCollider.getGroup() == PHY_GROUP.PLAYER) {
            const otherNode = otherCollider.node;
            if (otherNode) {
                const guest:PlayerController = otherNode.getComponent(PlayerController);
                return guest;
            }
        }

        return null;
    }

    public isNeedAssistant() : boolean {
        return (this.curAssistantCount3d && this.curAssistantCount3d.getValue() < this.totalAssistantCount);
    }

    public onLeaveAssistant() {
        if (this.curAssistantCount3d) {
            const curCount = this.curAssistantCount3d.getValue();
            if (curCount > 0) {
                this.curAssistantCount3d.setValue(curCount - 1);
            }
        }
    }

    onTriggerEnter (event: ITriggerEvent) {
        const player:PlayerController = WorkZone.getGuestFromColliderEvent(event.otherCollider);
        if (player/* && player.hasItem(this.workItemType)*/){
            const levelUp = this.getComponent(LevelUpController);
            if (levelUp && levelUp.endVfx.active) {
                this.isBlinkOutline = false;
                levelUp.startLastTiming();
            }

            let index:number = 0;
            for (index = 0; index < this._players.length; index++) {
                if (this._players[index] == player) {
                    break;
                }
            }
            if (index >= this._players.length) {
                this._players.push(player);
                this._dropTimers.push(sys.now());
            }else
                this._dropTimers[index] = sys.now();
            
            this.blinkOutline(false);

        }
    }

    onTriggerExit (event: ITriggerEvent) {
        const player:PlayerController = WorkZone.getGuestFromColliderEvent(event.otherCollider);
        if (player){
            let hasPlayer:boolean = this.assistant && this.assistant.active;
            for (let index = 0; index < this._players.length; index++) {
                if (this._players[index] == player) {
                    this._dropTimers[index] = 0;
                    this._players[index] = null;
                }
                // if (this._dropTimers[index] != 0)
                //     hasPlayer = true;
                if (this._players[index])
                    hasPlayer = true;
            }

            if (!hasPlayer)
                this.blinkOutline(true);

            player.arrived(this.node, this.workerType, false, 0);
        }
    }

    public hasPlayer() : boolean {
        return this._hasPlayer;
    }
    
    public hasGoods() : boolean {
        return this.placePos.children.length > 0;
    }

    public isSelling() : boolean {
        return this.hasPlayer() && this.hasGoods();
    }

    protected blinkOutline(blink:boolean) {
        if (this._hasPlayer == blink) {
            this._hasPlayer = !blink;

            if (this.outlines) {
                this.outlines.forEach(outline => {
                    Tween.stopAllByTarget(outline);

                    if (blink && this.isScaleOutline) {
                        tween(outline)
                        .to(0.5, {scale:this._outlineBlinkScale})
                        .to(0.5, {scale:this._outlineOrgScale})
                        .union()
                        .repeatForever()
                        .start();
                    }
    
                    if (this.isBlinkOutline) {
                        const mesh = outline.getComponent(MeshRenderer);
                        if (mesh)
                            mesh.material = mesh.materials[blink ? 1 : 2];
                    }
                })
            }
        }
    }

    public sellGood() : Node {
        if (this.placePos && this.placePos.children.length > 0 && !this._isDropping) {
            const node = this.placePos.children[this.placePos.children.length - 1];
            node.setScale(Vec3.ONE);

            return node;
        }

        return null;
    }

    update(deltaTime: number) {
        if (this.assistant && this.assistant.active)
            this.blinkOutline(false);
        
        this._isDropping = false;

        if (this._players.length > 0) {
            if (!this._players[this._players.length - 1]) {
                this._players.pop();
                this._dropTimers.pop();
            }
        }
        if (this._players.length > 0) {
            if (!this._players[0]) {
                this._players.shift();
                this._dropTimers.shift();
            }
        }

        if (this.progressMaterial) {
            let player:PlayerController = null;
            const curCount = this.curAssistantCount3d ? this.curAssistantCount3d.getValue() : null;

            if (this.totalAssistantCount > curCount) {
                for (let index = 0; index < this._players.length; index++) {
                    const element = this._players[index];
                    if (element && element.hasFollowAssistant()) {
                        player = element;
                        break;
                    }
                }
            }

            let progress = this._progressNumber;
            if (player)
                progress += deltaTime * 1.5;
            else
                progress -= deltaTime * 2;

            if (progress > 1) {
                progress = 1;

                if (player) {
                    const addCount = player.arrived(this.node, this.workerType, true, this.totalAssistantCount - curCount);
                    if (addCount > 0) {
                        this.curAssistantCount3d.setValue(curCount + addCount);
                        if (curCount == 0) {
                            this.activeNodes.forEach(node => {
                                node.active = true;
                            });
                        }
                    }
    
                }
            } else if (progress < 0) {
                progress = 0;
            }

            if (progress != this._progressNumber) {
                this._progressNumber = progress;
                this.progressMaterial.setProperty('progress', this._progressNumber);
            }
        }

        if (this.placePos) {
            for (let index = 0; index < this._dropTimers.length; index++) {
                if (this._players[index]) {
                    const dropTimer = this._dropTimers[index];
                    if (dropTimer > 0) {
                        this._isDropping = true;
                        if (sys.now() > dropTimer + this.dropInterval) {
                            const item = this._players[index].fetchItem(this.allAcceptable ? -1 : this.workItemType);
                            
                            if (item) {
                                this._dropTimers[index] = sys.now();
        
                                const element = item.node;
                                element.setScale(Vec3.ONE);
                                element.setRotation(Quat.IDENTITY);
                                // !!!!!!!!!!!!!
                                const levelup = this.getComponent(LevelUpController);
                                if (levelup)
                                    levelup.receiveGood(element, true);
                                else {
                                    element.getWorldPosition(this._tempPos);
                                    element.setParent(this.placePos);
                                    element.setWorldPosition(this._tempPos);
                
                                    if (this._placeHalfDimention != null) {
                                        Utils.calcArrangePos(this._placeHalfDimention, item.getHalfDimension(), 
                                            this.placePos.children.length - 1, this._tempPos);
                
                                        if (this.placeParabola)
                                            ParabolaTween.moveNodeParabola(element, this._tempPos, 2, 0.5, -1, 0, false);
                                        else {
                                            element.setPosition(this._tempPos);
                                            item.scaleEffect(randomRange(0.2, 0.4));
                                        }
                                    } else {
                                        ParabolaTween.moveNodeParabola(element, Vec3.ZERO, 2, 0.5, 0.5, 360);
                                    }
                
                                    if (this.itemSound.length)
                                        SoundMgr.playSound(this.itemSound);
                                }
                                
                            } else
                                this._dropTimers[index] = 0;
                        }            
                    }
                }
            }
    
        }
    }
}


