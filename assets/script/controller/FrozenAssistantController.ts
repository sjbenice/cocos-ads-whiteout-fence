import { _decorator, animation, CCString, Component, EPSILON, instantiate, Node, ParticleSystem, Prefab, Quat, random, randomRange, randomRangeInt, SkeletalAnimation, SkinnedMeshRenderer, tween, v3, Vec3 } from 'cc';
import { Utils } from '../library/util/Utils';
import { Item } from '../library/controller/Item';
import { SoundMgr } from '../library/manager/SoundMgr';
import { FenceController } from './FenceController';
import { LevelUpController } from './LevelUpController';
import { FoodMgr } from '../manager/FoodMgr';
import { ParabolaTween } from '../library/util/ParabolaTween';
import { GhostMgr } from '../manager/GhostMgr';
import { GhostController } from './GhostController';
import { Emoji } from '../library/ui/Emoji';
import { WorkZone } from './WorkZone';
const { ccclass, property } = _decorator;

enum State {
    FROZEN,
    FOLLOW,
    WORK,
    DIE
}

export enum WorkerType {
    None=0, Builder, Woolworker, Diner
}

@ccclass('FrozenAssistantController')
export class FrozenAssistantController extends Component {
    public workPos:Node = null;
    public fenceGroup:Node = null;
    public sheepGroup:Node = null;
    public levelUp:LevelUpController = null;
    public foodMgr:FoodMgr = null;
    public ghostMgr:GhostMgr = null;
    
    @property(Node)
    helpIcon:Node = null;

    @property(ParticleSystem)
    vfxUnfrozen:ParticleSystem = null;

    @property(ParticleSystem)
    vfxBeWorkers:ParticleSystem[] = [];

    @property(CCString)
    sfx:string = '';

    @property(Node)
    placePos:Node = null;

    @property(Prefab)
    woolPrefab:Prefab = null;
    
    @property(Emoji)
    emoji:Emoji = null;

    @property(Node)
    hungryIcon:Node = null;

    protected _workerType:number = WorkerType.None;
    protected _workerIndex:number = 0;
    protected _zone:Node = null;

    protected _followDistance:number = 1;
    protected _speed:number = 2.5;
    protected _angleSpeed:number = 1000;

    protected _state:number = State.FROZEN;
    protected _followParentNode:Node = null;
    protected _followChildNode:Node = null;

    protected _skin:SkinnedMeshRenderer = null;
    protected _animationController: animation.AnimationController;
    protected _anim:SkeletalAnimation = null;
    protected _curAnimName:string = null;

    protected _moving:boolean = false;
    protected _tempPos:Vec3 = Vec3.ZERO.clone();

    protected _targetPos:Vec3 = Vec3.ZERO.clone();
    protected _destPos:Vec3 = Vec3.ZERO.clone();
    protected _velocity:Vec3 = Vec3.ZERO.clone();
    protected _tempQuat:Quat = Quat.IDENTITY.clone();
    protected _distance:number = 0;

    protected _isWorking:boolean = false;
    protected _fence:FenceController = null;
    protected _workTimer:number = 0;
    protected _workInterval:number = 1;
    protected _workCount:number = 0;

    protected _fenceRadius:number = 0;
    protected _fenceGap:number = 0.8;
    protected _fenceInternal:number = 0.8;

    protected _isReadyServe:boolean = false;
    protected _isFooding:boolean = false;

    protected onLoad(): void {
        this._skin = this.getComponentInChildren(SkinnedMeshRenderer);

        if (animation.AnimationController) {
            this._animationController = this.getComponent(animation.AnimationController);
            if (!this._animationController)
                this._animationController = this.getComponentInChildren(animation.AnimationController);
        }

        this._anim = this.getComponentInChildren(SkeletalAnimation);
    }

    start() {
        if (this.helpIcon) {
            tween(this.helpIcon)
            .by(1, {position:v3(0, 0.5, 0)})
            .by(1, {position:v3(0, -0.5, 0)})
            .union()
            .repeatForever()
            .start();
        }
    }

    update(deltaTime: number) {
        const velocity = deltaTime * this._speed * (this._state == State.FOLLOW ? 2 : 1);

        if (this._moving) {
            this.node.getWorldPosition(this._tempPos);

            Vec3.subtract(this._velocity, this._targetPos, this._tempPos);
            Utils.faceViewCommon(this._velocity, deltaTime, this.node, this._angleSpeed);

            let distance = this._velocity.length() - this._distance;

            this._velocity.normalize();
            this._velocity.multiplyScalar(distance);
            Vec3.add(this._destPos, this._tempPos, this._velocity);

            Vec3.subtract(this._velocity, this._destPos, this._tempPos);
            distance = this._velocity.length();

            this._velocity.normalize();

            this._velocity.multiplyScalar(velocity);
            this._tempPos.add(this._velocity);

            if (distance < EPSILON) {
                this._moving = false;
                this.node.setWorldPosition(this._destPos);
            } else {
                if (velocity >= distance) {
                    this.node.setWorldPosition(this._destPos);
                } else {
                    this.node.setWorldPosition(this._tempPos);
                }
            }
        }

        this.setAnimationName(this._moving ? (this.placePos.children.length > 0 ? 'walk_carry' : 'walk') : (this._isWorking ? (this._workerType == WorkerType.Builder ? 'work' : 'serve'): (this.placePos.children.length ? 'idle_carry' : 'idle')));
        this.setAnimationValue('Speed', this._moving ? velocity : 0);

        switch (this._state) {
            case State.FOLLOW:
                if (this._followParentNode) {
                    this._followParentNode.getWorldPosition(this._targetPos);
                    this._distance = this._followDistance;
                    this._moving = true;
                }
                break;
        
            case State.WORK:
                switch (this._workerType) {
                    case WorkerType.Builder:
                        if (this._isWorking) {
                            this._workTimer += deltaTime;
                            if (this._workTimer > this._workInterval) {
                                this._workTimer = 0;

                                SoundMgr.playSound('hammer');

                                if (this._fence && this._fence.constructFence()) {
                                    this._fence.setWorker(null);
                                    this._fence = null;
                                    this._isWorking = false;

                                    this.increaseWorkCount();
                                }
                            }
                        } else {
                            if (!this._moving) {
                                if (!this._fence) {
                                    this._fence = this.findNearstFence();
                                    if (this._fence)
                                        this._fence.setWorker(this.node);
                                }
    
                                if (this._fence) {
                                    this.getFenceWorkPos(this._fence.node, this._tempPos);
    
                                    if (Vec3.equals(this.node.position, this._tempPos, EPSILON)) {
                                        Utils.faceViewCommon(this.getFenceFace(this._fence.node), 2, this.node, this._angleSpeed);        
                                        this._isWorking = true;
                                    } else {
                                        const curPos = this.node.position;
                                        
                                        const isXSide = Math.abs(Math.abs(curPos.x) - this._fenceInternal) < EPSILON;
                                        const isZSide = Math.abs(Math.abs(curPos.z) - this._fenceInternal) < EPSILON;
                                        
                                        if (isXSide || isZSide) {
                                            if (Math.abs(this._tempPos.x - curPos.x) < EPSILON
                                                || Math.abs(this._tempPos.z - curPos.z) < EPSILON) {
                                                this._targetPos.set(this._tempPos);
                                            } else if (isXSide && Math.abs(this._tempPos.z) == this._fenceInternal) {
                                                this._targetPos.set(curPos);
                                                this._targetPos.z = this._tempPos.z;
                                            } else if (isZSide && Math.abs(this._tempPos.x) == this._fenceInternal) {
                                                this._targetPos.set(curPos);
                                                this._targetPos.x = this._tempPos.x;
                                            } else {
                                                this._targetPos.set(curPos);

                                                if (isXSide)
                                                    this._targetPos.z = this._fenceInternal;
                                                else
                                                    this._targetPos.x = this._fenceInternal;
                                            }
                                        } else {
                                            this._targetPos.set(curPos);

                                            if (Math.abs(curPos.x) > Math.abs(curPos.z)) {
                                                this._targetPos.x = Math.sign(curPos.x) * (this._fenceInternal);
                                            } else {
                                                this._targetPos.z = Math.sign(curPos.z) * (this._fenceInternal);
                                            }

                                        }
                                        this._moving = true;
                                    }
        
                                }
                            }
                        }
                        break;
                
                    case WorkerType.Woolworker:
                        if (this._isWorking) {
                            this._workTimer += deltaTime;
                            if (this._workTimer > this._workInterval * 4) {
                                this._workTimer = 0;

                                this._isWorking = false;
                                
                                // if (this._workCount >= 4) {
                                    if (random() < 0.3)
                                        SoundMgr.playSound('sheep');

                                    const wool = instantiate(this.woolPrefab);
                                    this.placePos.addChild(wool);

                                    this.node.getWorldPosition(this._targetPos);
                                    this._targetPos.z += 4.5;
                                    this._moving = true;
                                // } else
                                //     this.move2sheep();
                            }
                        } else {
                            if (!this._moving) {
                                if (this.placePos.children.length > 0) {
                                    if (this.levelUp) {
                                        while (this.placePos.children.length > 0) {
                                            this.levelUp.receiveGood(this.placePos.children[this.placePos.children.length - 1], false);
                                        }

                                        this.move2sheep();

                                        this.increaseWorkCount();
                                    }
                                } else {
                                    this._isWorking = true;

                                    let direction:Vec3 = null;
                                    switch (this._workerIndex) {
                                        case 0:
                                            direction = Vec3.FORWARD;
                                            break;
                                        case 1:
                                            direction = Utils.Vec3Left;
                                            break;
                                        case 2:
                                            direction = Vec3.RIGHT;
                                            break;
                                    }

                                    Utils.faceViewCommon(direction, 2, this.node, this._angleSpeed);
                                }
                            }
                        }
                        break;

                    case WorkerType.Diner:
                        if (this.placePos.children.length == 0) {
                            if (!this._moving) {
                                if (this._isReadyServe) {
                                    if (this.foodMgr) {
                                        const food = this.foodMgr.findNearstFood(this.node, this._targetPos);
                                        if (food) {
                                            food.getWorldPosition(this._tempPos);
                                            food.setParent(this.placePos);
                                            food.setWorldPosition(this._tempPos);
        
                                            ParabolaTween.moveNodeParabola(food, Vec3.ZERO, 2, 0.2, -1, 0, false);

                                            this._isReadyServe = false;
                                        } else
                                            this._moving = true;
                                    }
                                } else {
                                    this._isReadyServe = true;

                                    this.foodMgr.node.getWorldPosition(this._targetPos);
                                    this._moving = true;
                                }
                            }
                        } else {
                            if (!this._moving) {
                                if (this.ghostMgr && !this._isFooding) {
                                    const ghost = this.ghostMgr.findNearstWait(this.node, this._targetPos);
                                    if (ghost) {
                                        this._isFooding = true;

                                        ghost.getComponent(GhostController).receiveFood(this.node, this.placePos.children[0]);

                                        this.scheduleOnce(()=>{
                                            Utils.removeChildrenDestroy(this.placePos);
                                            this._isFooding = false;

                                            this.increaseWorkCount();
                                        }, 1);
                                    } else {
                                        this._moving = true;
                                    }
                                }
                            }
                        }
                        break;

                    default:
                        break;
                }
                break;
            default:
                break;
        }
    }

    public isFrozen() : boolean {
        return this._state == State.FROZEN;
    }

    public getFollowChild() : FrozenAssistantController {
        return this._followChildNode ? this._followChildNode.getComponent(FrozenAssistantController) : null;
    }

    public getFollowLastNode() : Node {
        if (this._followChildNode)
            return this._followChildNode.getComponent(FrozenAssistantController).getFollowLastNode();
        
        return this.node;
    }

    public setFollowNode(node:Node){
        this._followParentNode = node;

        if (node) {
            const parentAssistant = node.getComponent(FrozenAssistantController);
            if (parentAssistant) {
                parentAssistant._followChildNode = this.node;
            }

            this._state = State.FOLLOW;

            if (this.helpIcon && this.helpIcon.active) {
                this.helpIcon.active = false;

                if (this._skin)
                    this._skin.material = this._skin.materials[1];
    
                if (this.vfxUnfrozen)
                    this.vfxUnfrozen.play();
    
                SoundMgr.playSound(this.sfx);
            }
        }
    }

    public setWorkerType(type:number, workerIndex:number, zone:Node) {
        if (this._state == State.FOLLOW && type != WorkerType.None) {
            this.scheduleOnce(()=>{
                this._state = State.WORK;

                if (this._workerType == WorkerType.Woolworker) {
                    this.move2sheep();
                }
            }, 1);

            this._workerType = type;
            this._workerIndex = workerIndex;
            this._zone = zone;

            this._workInterval = randomRange(0.3, 0.4);

            this._distance = 0;

            this._followParentNode = null;
            this._followChildNode = null;

            this.vfxBeWorkers.forEach(vfx => {
                vfx.play();
            });

            if (this.workPos) {
                this.node.getWorldPosition(this._tempPos);
                this.node.setParent(this.workPos);
                this.node.setWorldPosition(this._tempPos);
            }

            if (this.fenceGroup) {
                const pos = this.fenceGroup.children[0].position;
                this._fenceRadius = Math.max(Math.abs(pos.x), Math.abs(pos.z));
                this._fenceInternal = this._fenceRadius - this._fenceGap;
            }
        }
    }

    protected setAnimationValue(tag:string, value:any){
        if (this._animationController)
            this._animationController.setValue(tag, value);
    }

    protected setAnimationName(newAnim:string) {
        if (this._anim && newAnim != this._curAnimName) {
            this._anim.play(newAnim);
            this._curAnimName = newAnim;
        }
    }

    public fetchItem(itemType:number) : Item {
        if (this.placePos && this.placePos.children.length) {
            const item = this.placePos.children[this.placePos.children.length - 1].getComponent(Item);
            if (item.isType(itemType))
                return item;
        }

        return null;
    }

    protected findNearstFence() : FenceController {
        let ret:FenceController = null;
        let minDistance:number = Infinity;

        this.fenceGroup.children.forEach(element => {
            const fence = element.getComponent(FenceController);
            if (fence && fence.isConstructable()) {
                const distance = Vec3.squaredDistance(this.node.position, element.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    ret = fence;
                }
            }
        });

        return ret;
    }

    protected getFenceWorkPos(node:Node, ioPos:Vec3) {
        if (node) {
            const pos = node.position;
            ioPos.set(pos);
            if (Math.abs(pos.x) == this._fenceRadius) {
                ioPos.x -= this._fenceGap * Math.sign(pos.x);
            } else {
                ioPos.z -= this._fenceGap * Math.sign(pos.z);
            }
        }
    }

    protected getFenceFace(node:Node) : Vec3 {
        if (node) {
            const pos = node.position;
            if (Math.abs(pos.x) == this._fenceRadius) {
                return Math.sign(pos.x) > 0 ? Vec3.RIGHT : Utils.Vec3Left;
            } else {
                return Math.sign(pos.z) > 0 ? Utils.Vec3Backward : Vec3.FORWARD;
            }
        }
        return null;
    }

    protected move2sheep() {
        if (this.sheepGroup) {
            this.sheepGroup.getWorldPosition(this._targetPos);
            switch (this._workerIndex) {
                case 0:
                    this._targetPos.z += 1.5;
                    break;
                case 1:
                    this._targetPos.x += 1.7;
                    break;
                case 2:
                    this._targetPos.x -= 1.7;
                    break;
            }

            this._moving = true;
        }
    }

    protected getMaxWorkCount() : number {
        let ret:number = 0;
        switch (this._workerType) {
            case WorkerType.Builder:
                ret = 12;
                break;
        
            case WorkerType.Woolworker:
                ret = 5;
                break;

            default:
                ret = 3;
                break;
        }

        return ret;
    }

    protected increaseWorkCount(amount:number = 1) : boolean {
        this._workCount += amount;

        if (this._workCount >= this.getMaxWorkCount()) {
            this._workCount = 0;

            if (this._zone) {
                const workZone = this._zone.getComponent(WorkZone);
                if (workZone)
                    workZone.onLeaveAssistant();

                this._zone = null;
            }

            // this._targetPos.set(this.node.position);

            // switch (this._workerType) {
            //     case WorkerType.Builder:
            //         this._targetPos.multiplyScalar(3);
            //         break;
            //     default:
            //         this._targetPos.x *= 2;
            //         this._targetPos.z += 16;
            //         break;
            // }

            // this._moving = true;

            this._workerType = WorkerType.None;

            // if (this.emoji)
            //     this.emoji.setType(Emoji.TYPE.TIRED);

            // this.scheduleOnce(()=>{
            //     this.node.removeFromParent();
            //     this.node.destroy();
            // }, 5);

            this._moving = false;
            this.vfxBeWorkers.forEach(vfx => {
                vfx.play();
            });

            tween(this.node)
            .to(0.5, {scale:Vec3.ZERO})
            .call(()=>{
                this.node.removeFromParent();
                this.node.destroy();
            })
            .start();

            return true;
        }

        return false;
    }
}


