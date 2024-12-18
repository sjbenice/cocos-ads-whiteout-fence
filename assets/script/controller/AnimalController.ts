import { _decorator, CCString, Component, Enum, EPSILON, instantiate, Node, ParticleSystem, Prefab, Quat, random, randomRange, SkeletalAnimation, sys, Tween, tween, v3, Vec3 } from 'cc';
import { SoundMgr } from '../library/manager/SoundMgr';
import { AvatarController } from '../library/controller/AvatarController';
import { ItemType } from '../manager/ItemType';
import { Utils } from '../library/util/Utils';
import { ProgressBubble } from './ProgressBubble';
import { ParabolaTween } from '../library/util/ParabolaTween';
const { ccclass, property } = _decorator;

enum State {
    IDLE,
    HUNGRING,
    HUNGRIED,
    FOLLOW,
    MILK,
};

@ccclass('AnimalController')
export class AnimalController extends AvatarController {
    public fieldHalfDimetion:Vec3 = null;
    public cameraNode:Node = null;
    public trashPos:Node = null;

    @property({type: Enum(ItemType)})
    type:ItemType = ItemType.NONE;

    @property(ProgressBubble)
    productBubble:ProgressBubble = null;

    @property(ProgressBubble)
    hungryBubble:ProgressBubble = null;

    @property
    bubbleSpeed:number = 0.02;

    @property(Node)
    productPos:Node = null;

    @property
    productTime:number = 2;

    @property
    productCount:number = 4;

    @property(Prefab)
    productPrefab:Prefab = null;

    @property(CCString)
    productSfx:string = '';

    @property(CCString)
    productEmpySfx:string = '';

    @property
    idleSpeed:number = 0.1;

    @property
    idleMoveTime:number = 1;

    @property
    followWeight:number = 0.25;

    @property
    followDistance:number = 0.5;

    @property(ParticleSystem)
    followVfx:ParticleSystem = null;

    @property(Node)
    hayPos:Node = null;

    @property(Prefab)
    hayPrefab:Prefab = null;

    protected _fieldPos:Vec3 = null;
    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _productIconOrgPos:Vec3 = null;
    protected _productIconMovePos:Vec3 = null;

    protected _productTimer:number = 0;
    protected _productTime:number = 0;

    protected _moveTimer:number = 0;
    protected _moveInput:Vec3 = Vec3.ZERO.clone();

    protected _state:State = State.IDLE;
    protected _followNode:Node = null;

    protected _orgParent:Node = null;
    protected _prevPos:Vec3 = Vec3.ZERO.clone();

    protected _firstTime:boolean = true;

    protected _bubbleTimer:number = 0;

    protected _hay:Node = null;
    protected _eatSpeed:number = 0;

    protected _productCount:number = 0;

    protected _chaseNode:Node = null;

    public needFollow() : boolean {
        return this._state == State.HUNGRIED;
    }
    
    public followMe(node:Node, canFollowed:boolean) : boolean {
        let ret:boolean = false;
        let checkChase:boolean = true;
        
        switch (this._state) {
            case State.HUNGRIED:
                if (canFollowed) {
                    this._state = !this.hungryBubble.node.active ? State.MILK : State.FOLLOW;

                    if (this.hungryBubble.node.active) {
                        SoundMgr.playSound('catch');
                    }
    
                    this._followNode = node;
        
                    ret = true;
                }
                break;
            case State.FOLLOW:
            case State.MILK:
                checkChase = false;
                break;
        }

        if (checkChase && (!canFollowed || !ret)) {
            this._chaseNode = node;
        }

        return ret;
    }

    protected unfollow() {
        this._state = State.HUNGRIED;

        // this._followNode = null;
    }

    public onFollowing(node:Node) : boolean {
        let ret:boolean = false;
        if (this._followNode == node) {
            const isMoving = !Vec3.equals(this._moveInput, Vec3.ZERO, EPSILON);
            switch (this._state) {
                case State.FOLLOW:
                    ret = true;
                    if (this.followVfx) {
                        if (isMoving)
                            this.followVfx.stop();
                        else if (!this.followVfx.isPlaying)
                            this.followVfx.play();
                    }

                    if (!isMoving && this.hungryBubble) {        
                        // if (this.hayPos && this.hayPos) {
                        //     this.hayPos.getWorldPosition(this._tempPos);
                        //     this._hay = instantiate(this.hayPrefab);
                        //     this.node.parent.parent.addChild(this._hay);
                        //     this._hay.setWorldPosition(this._tempPos);

                        //     this._eatSpeed = Math.floor(this._hay.children.length / this.hungryBubble.getTotalSteps());// * this.bubbleSpeed);
                        // }
                        // this._state = State.EATING;

                        if (this._bubbleTimer == 0 || this._bubbleTimer + this.bubbleSpeed * 1000 < sys.now()) {
                            this._bubbleTimer = sys.now();
                            if (this.hungryBubble.addStep(true)) {
                                this._state = State.MILK;
                                this.showHungryIcon(false);
                                this.showProductIcon(true);
        
                                this._bubbleTimer = 0;
        
                                this.playSfx(true);
                            }
                        }                    
                    }
                    break;
                case State.MILK:
                    ret = true;
                    if (!isMoving && this.productPos && this.productPos.children.length == 0) {
                        if (this._bubbleTimer == 0 || this._bubbleTimer + this.bubbleSpeed * 1000 < sys.now()) {
                            this._bubbleTimer = sys.now();
                            if (this._productCount < this.productCount) {
                                this._productCount ++;

                                const product = instantiate(this.productPrefab);
                                this.productPos.addChild(product);

                                if (this._productCount == this.productCount) {
                                    this._state = State.IDLE;//AWAY;
                                    this.showProductIcon(false);
                                    this._bubbleTimer = 0;
                                }
                            }
                        }
                    }
                    break;
                default:
                    // this._followNode = null;
                    break;
            }
        }

        return ret;
    }

    start() {
        if (super.start)
            super.start();

        this._fieldPos = this.node.getPosition();

        if (this.productBubble) {
            this._productIconOrgPos = this.productBubble.node.getPosition();
            this._productIconMovePos = this._productIconOrgPos.clone();
            this._productIconMovePos.y += 0.2;

            // this.productIcon.getComponent(Billboard).cameraNode = this.cameraNode;
        }

        this._orgParent = this.node.parent;

        this.initProduct();
    }

    protected initProduct() {
        this._productTime = randomRange(1, 1.5) * this.productTime;
        this._productTimer = this._firstTime ? this._productTime : 0;
        
        this._firstTime = false;
    }

    protected idleMove(deltaTime: number) {
        if (this.idleSpeed > 0 && this._chaseNode == null) {
            this._moveTimer += deltaTime;
            if (this._moveTimer > this.idleMoveTime) {
                this._moveTimer = 0;
                if (Vec3.equals(this._moveInput, Vec3.ZERO, EPSILON)) {
                    this._moveInput.x = randomRange(-0.5, 0.5);
                    this._moveInput.z = randomRange(-0.5, 0.5);
                    this._moveInput.normalize();
                    this._moveInput.multiplyScalar(this.idleSpeed);
                } else
                    this._moveInput.set(Vec3.ZERO);
            }
        } else
            this._moveInput.set(Vec3.ZERO);
    }

    update(deltaTime: number) {
        switch (this._state) {
            case State.IDLE:
                this._productTimer += deltaTime;
                if (this._productTimer > this._productTime) {
                    this._productTimer = 0;
                    this._state = State.HUNGRING;

                    this.showHungryIcon(true);
                } else {
                    this.idleMove(deltaTime);
                }
                break;
            case State.HUNGRING:
                this._moveInput.set(Vec3.ZERO);
                if (this.hungryBubble && this.hungryBubble.node.active) {
                    if (this._bubbleTimer + this.bubbleSpeed * 1000 < sys.now()) {
                        this._bubbleTimer = sys.now();

                        if (this.hungryBubble.addStep(true)) {
                            this.hungryBubble.showMode(false);

                            this._state = State.HUNGRIED;
                            this._bubbleTimer = 0;

                            this.playSfx(false);
                        }
                    }
                }
                break;
            case State.HUNGRIED:
                this.idleMove(deltaTime);
                break;
            case State.FOLLOW:
            case State.MILK:
                if (this._followNode) {
                    this._followNode.getWorldPosition(this._moveInput);
                    this.node.getWorldPosition(this._tempPos);
                    this._moveInput.subtract(this._tempPos);
                    const distance = this._moveInput.length();
                    if (distance <= this.followDistance) {
                        this._moveInput.set(Vec3.ZERO);
                    } else {
                        this._moveInput.normalize();
                        if (distance > this.followDistance * 3) {
                            this._moveInput.set(Vec3.ZERO);

                            this.unfollow();

                            if (this.followVfx)
                                this.followVfx.stop();

                            // this._moveInput.multiplyScalar(Math.min(3, Math.exp(distance - this.followDistance)));
                            // this._moveInput.x += randomRange(-1, 1);
                            // this._moveInput.z += randomRange(-1, 1);
                        }
                    }
                }
                break;
            // case State.AWAY:
            //     if (this._followNode) {
            //         this.node.getWorldPosition(this._moveInput);
            //         this._followNode.getWorldPosition(this._tempPos);
            //         this._moveInput.subtract(this._tempPos);
            //         const distance = this._moveInput.length();
            //         if (distance > this.followDistance * 3) {
            //             this._moveInput.set(Vec3.ZERO);
            //             this._followNode = null;
            //             this._state = State.IDLE;
            //         } else {
            //             this._moveInput.normalize();
            //         }
            //     }
            //     break;

            default:
                break;
        }

        if (this._chaseNode) {
            if (Vec3.equals(this._moveInput, Vec3.ZERO)) {
                this.node.getWorldPosition(this._moveInput);
                this._chaseNode.getWorldPosition(this._tempPos);
                this._moveInput.subtract(this._tempPos);
                this._moveInput.normalize();
            }

            this._chaseNode = null;
        }

        if (super.update)
            super.update(deltaTime);
    }

    protected lateUpdate(dt: number): void {
        if (super.lateUpdate)
            super.lateUpdate(dt);

        if (this.node.position.y < 0) {
            this.node.getPosition(this._tempPos);
            this._tempPos.y = 0;
            this.node.setPosition(this._tempPos);
        }
    }

    protected calcReturnInput(ioVec3:Vec3) {
        this.node.getPosition(this._moveInput);
        this._moveInput.multiplyScalar(-1);
        this._moveInput.normalize();

        if (this.fieldHalfDimetion && this.node.position.z > this.fieldHalfDimetion.z) {
            this._moveInput.x += randomRange(-0.5, 0.5);
            this._moveInput.normalize();
            this._moveInput.multiplyScalar(Math.min(2, Math.exp(this.node.position.z - this.fieldHalfDimetion.z)));
        }
    }

    public isMoving() : boolean {
        return !Vec3.equals(this._moveInput, Vec3.ZERO, EPSILON);        
    }

    protected fetchMovementInput() : Vec3{
        return this._moveInput;
    }

    protected showProductIcon(show:boolean) {
        this._productCount = 0;

        if (this.productBubble)
            this.productBubble.showBubble(show);
    }


    public showHungryIcon(show:boolean) {
        if (this.hungryBubble) {
            if (this.hungryBubble.showBubble(show, 0.5) && show) {
                this.hungryBubble.showMode(true);
                this._bubbleTimer = 0;
            }
        }
    }

    protected playSfx(product:boolean) {
        if (random() < 0.1) {
            if (product) {
                if (this.productSfx.length)
                    SoundMgr.playSound(this.productSfx);
            } else {
                if (this.productEmpySfx.length)
                    SoundMgr.playSound(this.productEmpySfx);
            }
        }
    }

    public fetchProduct() : Node {
        return this.productPos.children.length > 0 ? this.productPos.children[0] : null;
    }

    public throwProduct(node:Node) {
        if (this.trashPos && node) {
            node.getWorldPosition(this._tempPos);
            this.trashPos.addChild(node);
            node.setWorldPosition(this._tempPos);

            this._tempPos.x += randomRange(1, 2);
            this._tempPos.y += 0.2;
            this._tempPos.z += randomRange(-1, 1);

            ParabolaTween.moveNodeParabola(node, this._tempPos, 4, 1, -1, 360, false);
            tween(node)
            .delay(5)
            .to(0.5, {scale:Vec3.ZERO})
            .call(()=>{
                node.removeFromParent();
                node.destroy();
            })
            .start();
        }
    }

    protected getNeedProductCount(progress:number) {
        const totalStep = this.productBubble.getTotalSteps();
        if (progress == 1)
            progress = 0;
        
        return Math.floor((totalStep - progress) * this.productCount / totalStep);
    }

}


