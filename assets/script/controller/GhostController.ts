import { _decorator, Collider, Component, CylinderCollider, EPSILON, ICollisionEvent, instantiate, ITriggerEvent, lerp, Node, ParticleSystem, Prefab, Quat, random, randomRange, RigidBody, SkeletalAnimation, sys, tween, v3, Vec3 } from 'cc';
import { Emoji } from '../library/ui/Emoji';
import { PHY_GROUP } from '../library/Layers';
import { FenceController } from './FenceController';
import { Utils } from '../library/util/Utils';
import { LevelUpController } from './LevelUpController';
import { ParabolaTween } from '../library/util/ParabolaTween';
import { SoundMgr } from '../library/manager/SoundMgr';
import { PlayerController } from './PlayerController';
import { ProgressBubble } from './ProgressBubble';
import { Item } from '../library/controller/Item';
const { ccclass, property } = _decorator;

enum State {
    TO_EAT,
    WAIT,
    EATING,
    PRODUCT,
    BACK,
}

@ccclass('GhostController')
export class GhostController extends Component {
    @property(Node)
    placePos:Node = null;

    @property(Emoji)
    emoji:Emoji = null;

    @property(ProgressBubble)
    hungryBubble:ProgressBubble = null;
    
    @property(CylinderCollider)
    collider:CylinderCollider = null;

    @property(CylinderCollider)
    trigger:CylinderCollider = null;

    @property(Prefab)
    productPrefab:Prefab = null;

    @property
    productCount:number = 3;

    @property(ParticleSystem)
    vfxFood:ParticleSystem = null;

    public startPos:Vec3 = Vec3.ZERO.clone();
    public endPos:Vec3 = Vec3.ZERO.clone();

    public levelUp:LevelUpController = null;
    public productPos:Node = null;

    protected _speed:number = 2;
    protected _angleSpeed:number = 600;

    protected _state:number = State.TO_EAT;

    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _tempPos2:Vec3 = Vec3.ZERO.clone();

    protected _moving:boolean = false;
    
    protected _targetPos:Vec3 = Vec3.ZERO.clone();
    protected _destPos:Vec3 = Vec3.ZERO.clone();
    protected _velocity:Vec3 = Vec3.ZERO.clone();
    protected _tempQuat:Quat = Quat.IDENTITY.clone();

    protected _anim:SkeletalAnimation = null;
    protected _curAnimName:string = null;

    protected _attackTimer:number = 0;
    protected _attackFence:FenceController = null;

    protected _waitTime:number = 0;
    protected _maxWaitTime:number = 0;

    protected _rigidBody:RigidBody = null;
    protected _idleTimer:number = 0;
    protected _idleMove:boolean = false;

    protected _bubbleTimer:number = 0;

    start() {
        if (this.hungryBubble) {
            this.hungryBubble.showMode(false);
            this.hungryBubble.showBubble(true);
        }

        if (!this.collider)
            this.collider = this.getComponent(CylinderCollider);

        if (this.collider) {
            this.collider.on('onCollisionEnter', this.onCollisionEnter, this);
        }

        if (this.trigger) {
            this.trigger.on('onTriggerEnter', this.onTriggerEnter, this);
            this.trigger.on('onTriggerStay', this.onTriggerEnter, this);
            this.trigger.on('onTriggerExit', this.onTriggerExit, this);
        }

        this._anim = this.getComponentInChildren(SkeletalAnimation);

        this._targetPos.set(this.endPos);
        this._moving = true;

        this._maxWaitTime = randomRange(10, 20);

        this._rigidBody = this.getComponent(RigidBody);
    }

    onDestroy() {
        if (this.collider) {
            this.collider.off('onCollisionEnter', this.onCollisionEnter, this);
        }

        if (this.trigger) {
            this.trigger.off('onTriggerEnter', this.onTriggerEnter, this);
            this.trigger.off('onTriggerStay', this.onTriggerEnter, this);
            this.trigger.off('onTriggerExit', this.onTriggerExit, this);
        }
    }

    onCollisionEnter (event: ICollisionEvent) {
        if (this._state == State.TO_EAT && this._attackFence == null) {
            this._attackFence = this.getFenceControllerFromEvent(event);
            if (this._attackFence) {
                this.enablePhysics(false);
                // this.setAnimationName('attack');
            }
        }
    }

    onCollisionStay (event: ICollisionEvent) {
        // if (this._attackFence && sys.now() > this._triggerTimer + 1600) {
        //     this._triggerTimer = sys.now();

        //     if (this._attackFence.destructFence()) {
        //         this.setAnimationName('walk');

        //         this._attackFence = null;
        //     } else
        //         this.setAnimationName('attack', true);
        // }
    }
    
    onCollisionExit (event: ICollisionEvent) {
        // if (this._isAttacking && this.getFenceControllerFromEvent(event)) {
        //     this.setAnimationName('walk');

        //     this._isAttacking = false;
        // }
    }

    protected getFenceControllerFromEvent(event:ICollisionEvent) : FenceController {
        if (event.otherCollider.getGroup() == PHY_GROUP.P_O_WALL) {
            let node = event.otherCollider.node;
            while (node) {
                const fence = node.getComponent(FenceController);
                if (fence) {
                    return fence;
                }

                node = node.parent;
            }
        }

        return null;
    }

    onTriggerEnter (event: ITriggerEvent) {
        if (this._state == State.WAIT && event.otherCollider.getGroup() == PHY_GROUP.PLAYER) {
            if (event.otherCollider.getComponent(PlayerController)) {
                event.otherCollider.node.getWorldPosition(this._targetPos);

                this.node.getWorldPosition(this._tempPos2);
                this._targetPos.subtract(this._tempPos2);

                const distance = this._targetPos.length() - 2;

                this._targetPos.normalize();

                Utils.faceViewCommon(this._targetPos, 1, this.node, this._angleSpeed);

                if (distance > 0) {
                    this._targetPos.multiplyScalar(distance);
                    this._targetPos.add(this._tempPos2)
                    this._moving = true;        
                } else
                    this._moving = false;

                this._idleMove = true;
            }
        }
    }

    onTriggerExit (event: ITriggerEvent) {
        if (this._state == State.WAIT && event.otherCollider.getGroup() == PHY_GROUP.PLAYER) {
            if (event.otherCollider.getComponent(PlayerController)) {
                this._moving = false;
            }
        }
    }

    protected setAnimationName(newAnim:string, force:boolean = false) {
        if (this._anim && newAnim != this._curAnimName || force) {
            this._anim.play(newAnim);
            this._curAnimName = newAnim;
        }
    }

    protected enablePhysics(enable:boolean) {
        if (this._rigidBody) {
            this._rigidBody.enabled = enable;
            this.getComponents(Collider).forEach(collider => {
                collider.enabled = enable;
            });
        }
    }

    update(deltaTime: number) {
        if (this._attackFence) {
            if (this._attackTimer == 0 || this._attackTimer > 1) {
                this._attackTimer = 0;

                if (this._attackFence.destructFence()) {
                    this.setAnimationName('walk');
    
                    this._attackFence = null;
                    this.enablePhysics(true);
                } else
                    this.setAnimationName('attack', true);
            }
            this._attackTimer += deltaTime;
        } else {
            const velocity = deltaTime * this._speed * (this._state == State.BACK ? 2 : 1);

            if (this._moving) {
                this.node.getWorldPosition(this._tempPos);
    
                Vec3.subtract(this._velocity, this._targetPos, this._tempPos);
                Utils.faceViewCommon(this._velocity, deltaTime, this.node, this._angleSpeed);
    
                let distance = this._velocity.length();
    
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
    
            this.setAnimationName(this._moving ? ((this.placePos == null || this.placePos.children.length == 0) ? 'walk' : 'walk_carry') : 'idle');
            // this.setAnimationValue('Speed', this._moving ? velocity : 0);
        }
        
        this._rigidBody.getLinearVelocity(this._tempPos);
        Vec3.lerp(this._tempPos, Vec3.ZERO, this._tempPos, deltaTime * 20);
        this._rigidBody.setLinearVelocity(this._tempPos);

        switch (this._state) {
            case State.TO_EAT:
                if (Vec3.distance(this.node.position, this._targetPos) < 2) {
                    this._state = State.WAIT;
                    if (random() < 0.2)
                        SoundMgr.playSound('cow_moo1');
                }
                break;
            case State.WAIT:
                this.updateEmojiTime(deltaTime);

                if (this.hungryBubble)
                    this.hungryBubble.showBubble(!this.emoji.isShown());
        
                this._idleTimer += deltaTime;
                if (this._idleTimer > 3) {
                    this._idleTimer = 0;

                    if (!this._idleMove) {
                        this._targetPos.set(this.endPos);
                        this._targetPos.x += randomRange(-1, 1);
                        this._targetPos.z += randomRange(-1, 1);

                        this._moving = true;

                        this._idleMove = true;
                    } else
                        this._idleMove  = false;
                }
                break;
            case State.EATING:
                if (this._bubbleTimer == 0 || this._bubbleTimer + 25 < sys.now()) {
                    this._bubbleTimer = sys.now();
                    if (this.hungryBubble && this.hungryBubble.addStep(true)) {
                        this._bubbleTimer = 0;

                        this.hungryBubble.showBubble(false, 0.5);

                        Utils.removeChildrenDestroy(this.placePos);

                        this._state = State.PRODUCT;

                        this.scheduleOnce(()=>{
                            this._state = State.BACK;

                            this._targetPos.set(this.startPos);
                            this._moving = true;
            
                            if (this.emoji && this.emoji.getType() <= Emoji.TYPE.TIRED)
                                this.emoji.setType(Emoji.TYPE.SMILE);
                        }, 0.5);
        
                        if (this.productPrefab) {
                            this.node.getWorldPosition(this._tempPos);

                            for (let index = 0; index < this.productCount; index++) {
                                const product = instantiate(this.productPrefab);
                                if (this.levelUp) {
                                    this.levelUp.node.addChild(product)
            
                                    product.setWorldPosition(this._tempPos);
                                    
                                    this.levelUp.receiveGood(product, true);
                                } else {
                                    product.getComponent(Item).setAutoDestroyTime(3);
    
                                    this.productPos.addChild(product);
    
                                    product.setWorldPosition(this._tempPos);
    
                                    product.getPosition(this._tempPos2);
                                    this._tempPos2.x += randomRange(-1, 1);
                                    this._tempPos2.z += randomRange(1, 2);
                                    this._tempPos2.y = 0.21;

                                    ParabolaTween.moveNodeParabola(product, this._tempPos2, 4, 0.5, -1, 90, false);
                                }
                            }
                        }
                    }
                }
                break;
            case State.BACK:
                if (!this._moving) {
                    Utils.removeChildrenDestroy(this.placePos);

                    this._state = State.TO_EAT;

                    this._targetPos.set(this.endPos);
                    this._moving = true;

                    if (this.hungryBubble) {
                        this.hungryBubble.showBubble(true);
                        this.hungryBubble.showMode(false);
                    }
    
                    this.enablePhysics(true);

                    this._waitTime = 0;
                    if (this.emoji)
                        this.emoji.setType(Emoji.TYPE.NONE);
                }

                break;
        }
    }

    protected updateEmojiTime(deltaTime:number) {
        this._waitTime += deltaTime;

        const emojiType = Math.floor(this._waitTime * (Emoji.TYPE.ANGRY - Emoji.TYPE.TIRED + 1) / this._maxWaitTime);
        if (emojiType >= Emoji.TYPE.TIRED && this.emoji)
            this.emoji.setType(emojiType);
    }

    public isWaiting() : boolean {
        // return (this._state == State.WAIT || this._attackFence != null) && !this.hasFood();
        return this._state < State.EATING && !this.hasFood();
    }

    public hasFood() : boolean {
        return this.placePos && this.placePos.children.length > 0;
    }

    public receiveFood(assistant:Node, food:Node) : boolean {
        if (food && this._state != State.EATING) {//!this.hasFood() && this.placePos) {
            assistant.getWorldPosition(this._tempPos);
            this.node.getWorldPosition(this._tempPos2);
            this._tempPos.subtract(this._tempPos2);
            this._tempPos.normalize();
            Utils.faceViewCommon(this._tempPos, 10, this.node, this._angleSpeed);

            food.getWorldPosition(this._tempPos);

            food.setParent(this.placePos);
            food.setWorldPosition(this._tempPos);

            ParabolaTween.moveNodeParabola(food, Vec3.ZERO, 2, 0.3, -1, 0, false);

            this._state = State.EATING;
            this._attackFence = null;
            this.enablePhysics(false);

            if (this.vfxFood)
                this.vfxFood.play();

            this._moving = false;

            if (this.emoji)
                this.emoji.setType(Emoji.TYPE.NONE);
            if (this.hungryBubble)
                this.hungryBubble.showBubble(true);

            return true;
        }

        return false;
    }
}


