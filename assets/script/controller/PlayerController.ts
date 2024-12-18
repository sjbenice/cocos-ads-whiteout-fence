import { _decorator, AudioSource, CCString, Collider, Color, Graphics, ICollisionEvent, instantiate, ITriggerEvent, lerp, MeshRenderer, Node, Quat, randomRange, randomRangeInt, RenderTexture, RigidBody, SpriteFrame, sys, tween, Tween, v3, Vec3, Animation, AnimationState } from 'cc';
import { PHY_GROUP } from '../library/Layers';
import { AvatarController } from '../library/controller/AvatarController';
import { MoneyController } from '../library/ui/MoneyController';
import { CautionMark } from '../library/ui/CautionMark';
import { Utils } from '../library/util/Utils';
import { Item } from '../library/controller/Item';
import { SoundMgr } from '../library/manager/SoundMgr';
import { ParabolaTween } from '../library/util/ParabolaTween';
import { AnimalController } from './AnimalController';
import { ItemType } from '../manager/ItemType';
import { OutlineBlinkController } from '../library/controller/OutlineBlinkController';
import { FrozenAssistantController } from './FrozenAssistantController';
import event_html_playable from '../library/event_html_playable';
import { GhostController } from './GhostController';
const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends AvatarController {
    @property(Node)
    tutorArrow:Node = null;

    @property
    catchInterval:number = 100;

    @property(Node)
    placePos:Node = null;

    @property(Node)
    moneyPos:Node = null;

    @property(Node)
    topGroup:Node = null;
    @property
    topAnimationTime:number = 0.2;
    @property
    topAnimationY:number = 0.5;

    @property(MoneyController)
    money:MoneyController = null;

    @property(CCString)
    itemSound:string = '';

    @property(CautionMark)
    caution:CautionMark = null;

    @property
    itemMax:number = 0;

    @property
    itemParabolaHeight:number = 0;

    @property(Node)
    inputZone:Node = null;

    @property(Node)
    outputZone:Node = null;

    @property(AudioSource)
    audio:AudioSource = null;

    @property(Node)
    followMaxIcon:Node = null;

    @property(Node)
    sloganContainer:Node = null;
    @property(Node)
    sloganLabel:Node = null;

    @property(Node)
    showUiNodes:Node[] = [];

    @property(MeshRenderer)
    groundVfx:MeshRenderer = null;

    @property(RenderTexture)
    renderTexture:RenderTexture = null;

    @property(Graphics)
    renderGraphics:Graphics = null;

    @property(Node)
    assistant:Node = null;

    @property
    idleFirePackshotTime:number = 0;

    @property(Node)
    packshotMgr:Node = null;

    @property(Node)
    emptyYourHand:Node = null;

    @property(Node)
    milkPos:Node = null;

    @property(Node)
    hay:Node = null;

    @property
    hayShowZ:number = -11;

    @property(Node)
    unlockAfterMoney:Node[] = [];

    @property(Animation)
    groundVfxAnim:Animation = null;

    public static State = {
        NONE:-1,
        TO_IN:0,
        TO_OUT:1,
    };

    protected _state:number = PlayerController.State.NONE;
    
    protected _topAnimPos:Vec3 = Vec3.ZERO.clone();
    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _tempPos2:Vec3 = Vec3.ZERO.clone();
    protected _tempPos3:Vec3 = Vec3.ZERO.clone();

    protected _moving:boolean = false;
    protected _targetPos:Vec3 = Vec3.ZERO.clone();
    protected _velocity:Vec3 = Vec3.ZERO.clone();

    protected _followWeight:number = 0;
    protected _followAnimals:AnimalController[] = [];

    protected _followAnimalCaring:boolean = false;

    protected _sleepMoveTimer: number = 0;
    protected _sleepMoveInterval: number = 0;

    protected _rigidBody:RigidBody = null;

    protected _placeHalfDimention:Vec3 = null;
    protected _milkPlaceHalfDimention:Vec3 = null;

    protected _moveInput:Vec3 = Vec3.ZERO.clone();
    protected _cameraTutorPos:Vec3 = Vec3.ZERO.clone();
    protected _cameraTutorWaitFlag:boolean = false;
    protected _cameraTutorWaitDelay:number = 0;
    protected _cameraTutorFlag:boolean = false;
    protected _cameraTutorReturnFlag:boolean = false;
    protected _cameraTutorTimer:number = 0;
    protected _cameraTutorSpeed:number = 0;
    protected _cameraTutorTime:number = 0;

    protected _needUpdateRenderTexture:boolean = true;
    protected _renderTextureScale:Vec3 = Vec3.ONE.clone();

    protected _idleFirePackshotTimer:number = 0;

    protected _triggerTimer:number = 0;
    protected TRIGGER_INTERVAL:number = 100;

    protected _firstFollowAssistant:FrozenAssistantController = null;

    public servedFood:boolean = false;

    start() {
        if (super.start)
            super.start();

        this._topAnimPos.y = this.topAnimationY;
        this._placeHalfDimention = Utils.calcArrangeDimension(this.placePos);
        
        if (this.milkPos)
            this._milkPlaceHalfDimention = Utils.calcArrangeDimension(this.milkPos);

        this.topAnimation(true);

        if (this.isBot()) {
            this._state = PlayerController.State.TO_IN;//TO_OUT
        }

        this._moving = true;

        this.showSlogan(true, true);

        if (this.emptyYourHand)
            this.emptyYourHand.active = false;
    }

    protected doCollisionEnter(event: ICollisionEvent){
        const guest = PlayerController.getGuestFromColliderEvent(event.otherCollider);
        if (guest) {
            this.onCollision(guest, true);
        }

        if (event.otherCollider && event.otherCollider.getGroup() == PHY_GROUP.OBJECT) {
            if (this.placePos.children.length > 0) {
                const otherNode = event.otherCollider.node;
                if (otherNode) {
                    const ghost = otherNode.getComponent(GhostController);
                    if (ghost) {
                        ghost.receiveFood(this.node, this.placePos.children[this.placePos.children.length - 1]);

                        this.servedFood = true;
                        // Utils.removeChildrenDestroy(this.placePos);
                    }
                }
            }
        }
        
        if (event.otherCollider && event.otherCollider.getGroup() == PHY_GROUP.ITEM) {
            const item = event.otherCollider.getComponent(Item);
            if (item)
                this.catchItem(item);
        }
    }

    protected doTriggerEnter(event: ITriggerEvent){
        if (event.otherCollider.getGroup() == PHY_GROUP.TRIGGER) {
            if (this.isBot() && 
                ((this._state == PlayerController.State.TO_IN && event.otherCollider.node == this.inputZone)
                 || (this._state == PlayerController.State.TO_OUT && event.otherCollider.node == this.outputZone))) {
                this._moving = false;
            }

            const blinkController = event.otherCollider.node.getComponent(OutlineBlinkController);
            if (blinkController) {
                blinkController.blinkOutline(false);
            }
        }

        this.onTrigger(event, true);
    }

    protected doTriggerStay(event: ITriggerEvent): void {
        this.onTrigger(event, false);
    }

    protected doTriggerExit(event: ITriggerEvent): void {
        if (event.otherCollider.getGroup() == PHY_GROUP.TRIGGER) {
            if (this.isBot() && !this._moving) {
                switch (this._state) {
                    case PlayerController.State.TO_IN:
                        this._moving = event.otherCollider.node == this.inputZone;
                        break;
                
                    case PlayerController.State.TO_OUT:
                        this._moving = event.otherCollider.node == this.outputZone;
                        break;
                }
            }

            const blinkController = event.otherCollider.node.getComponent(OutlineBlinkController);
            if (blinkController) {
                blinkController.blinkOutline(true);
            }
        }
    }

    public hasFollowAssistant() : boolean {
        return this._firstFollowAssistant != null;
    }

    public arrived(node:Node, zoneType:number, enter:boolean, needCount:number) : number {
        if (this.isBot()) {
            switch (this._state) {
                case PlayerController.State.TO_IN:
                    if (node == this.inputZone)
                        this._moving = !enter;
                    break;
            
                case PlayerController.State.TO_OUT:
                    if (node == this.outputZone)
                        this._moving = !enter;
                    break;
            }
        }

        let addCount:number = 0;
        if (enter && zoneType > 0) {
            while (needCount > 0 && this._firstFollowAssistant != null) {
                const nextAssistant = this._firstFollowAssistant.getFollowChild();
                
                this._firstFollowAssistant.setWorkerType(zoneType, needCount - 1, node);

                if (nextAssistant)
                    nextAssistant.setFollowNode(this.node);

                this._firstFollowAssistant = nextAssistant;
                needCount --;

                addCount ++;

                if (event_html_playable.version() == 2) {
                    if (this.packshotMgr)
                        this.packshotMgr.active = true;
                }
            }

            if (addCount > 0)
                SoundMgr.playSound('upgrade');
        }

        return addCount;
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

    protected getItemFromColliderEvent(otherCollider:Collider) : Item {
        if (otherCollider && otherCollider.getGroup() == PHY_GROUP.TRIGGER) {
            const otherNode = otherCollider.node;
            if (otherNode && otherNode.children.length > 0) {
                const item = otherNode.children[otherNode.children.length - 1].getComponent(Item);
                return item;
            }
        }

        return null;
    }

    protected onCollision(other:PlayerController, enter:boolean) {
        if (this.isBot() && !this.isSleeping()) {
            const baseTime = 2000 / this.baseSpeed;
            this.sleepMove(randomRangeInt(baseTime, baseTime * 1.5));

            // if (enter)
            //     SoundMgr.playSound('horn');
        }
    }

    protected showFollowMaxIcon() {
        if (this.followMaxIcon && !this.followMaxIcon.active) {
            this.followMaxIcon.active = true;
            this.scheduleOnce(()=>{
                this.followMaxIcon.active = false;
            }, 2);
        }
    }

    protected onTrigger(event: ITriggerEvent, enter:boolean) {
        if (event.otherCollider && event.otherCollider.getGroup() == PHY_GROUP.ITEM) {
            const otherNode = event.otherCollider.node;
            if (otherNode) {
                const animal = otherNode.getComponent(AnimalController);
                if (animal) {
                    if (animal.followMe(this.node, this.canFollowed())) {
                        this.registerFollowAnimal(animal);

                        if (!this.canFollowed()) {
                            this.showFollowMaxIcon();
                        }
                        this.showSlogan(false);
                    }
                }
            }
        }

        if (this._followAnimals.length > 0)
            return;

        if (event.otherCollider && event.otherCollider.getGroup() == PHY_GROUP.PLAYER) {
            const otherNode = event.otherCollider.node;
            if (otherNode) {
                const assistant = otherNode.getComponent(FrozenAssistantController);
                if (assistant) {
                    if (assistant.isFrozen()) {
                        if (!this._firstFollowAssistant) {
                            assistant.setFollowNode(this.node);
                            this._firstFollowAssistant = assistant;
                        } else {
                            assistant.setFollowNode(this._firstFollowAssistant.getFollowLastNode())
                        }

                        this.showSlogan(false);
                    }
                }
            }
        }

        let item = this.getItemFromColliderEvent(event.otherCollider);
        if (item && item.enabled) {
            if (item.type > 0 && !enter && this._triggerTimer > sys.now())
                return;
        
            this._triggerTimer = sys.now() + this.catchInterval;

            this.catchItem(item, false);
        }
    }

    protected catchItem(item:Item, twiceJump:boolean = false) : boolean {
        if (item.type == 0 && this.isBot())
            return false;

        let ret:boolean = true;

        let placePos:Node = null;
        let halfDimen:Vec3 = null;
        switch (item.type) {
            case 0:// money
                // if (this.milkPos && this.milkPos.children.length > 0)
                //     break;

                placePos = this.moneyPos;

                break;
            case ItemType.MILK:
                if (this.milkPos) {
                    // if (this.moneyPos.children.length == 0) {
                        placePos = this.milkPos;
                        halfDimen = this._milkPlaceHalfDimention;
                    // }
                    break;
                }
            default:
                placePos = this.placePos;
                halfDimen = this._placeHalfDimention;
                break;
        }

        if (placePos) {
            Tween.stopAllByTarget(item.node);
            item.stopParabola();
            item.node.setScale(Vec3.ONE);
            item.node.setRotation(Quat.IDENTITY);
            
            let orgItem:Item = item;

            if (item.replacePrefab) {
                const replaceGood = instantiate(item.replacePrefab);
                item = replaceGood.getComponent(Item);
            }

            let rotateY:boolean = false;
            let itemHalfDimen = item.getHalfDimension();
            if (itemHalfDimen.z > itemHalfDimen.x) {
                rotateY = true;
                itemHalfDimen = itemHalfDimen.clone();
                const temp = itemHalfDimen.x;
                itemHalfDimen.x = itemHalfDimen.z;
                itemHalfDimen.z = temp;
            }

            if (placePos.children.length == 0 || placePos.children[0].getComponent(Item).type == item.type) {
                const caution = !Utils.calcArrangePos(halfDimen, 
                    itemHalfDimen, placePos.children.length, this._tempPos);

                if (caution || (item.type > 0 && this.itemMax > 0 && placePos.children.length >= this.itemMax)) {
                    if (this.isBot() && this.outputZone) {
                        this._state = PlayerController.State.TO_OUT;
                        this._moving = true;
                        // this.moveTo(this.outputZone.getWorldPosition(this._tempPos));
                    }

                    if (this.caution)
                        this.caution.showCaution(true, 1);

                    if (orgItem != item) {
                        item.node.removeFromParent();
                        item.node.destroy();
                    }

                    ret = false;
                } else {
                    let useParabola = this.itemParabolaHeight > 0;

                    if (orgItem != item) {
                        if (orgItem.replaceVfxPrefab) {
                            const vfx = instantiate(orgItem.replaceVfxPrefab);
                            orgItem.node.parent.parent.parent.parent.addChild(vfx);
                            orgItem.node.getWorldPosition(this._tempPos2);
                            vfx.setWorldPosition(this._tempPos2);

                            tween(vfx)
                            .delay(2)
                            .call(()=>{
                                vfx.removeFromParent();
                                vfx.destroy();
                            })
                            .start();
                        }
                        orgItem.node.removeFromParent();
                        orgItem.node.destroy();

                        useParabola = false;
                    }

                    item.setAutoDestroyTime(0);
                    item.enablePhysics(false);
                    
                    item.node.getWorldPosition(this._tempPos2);
                    item.node.setParent(placePos);

                    if (rotateY)
                        item.node.setRotationFromEuler(v3(0, 90, 0));

                    if (useParabola) {
                        item.node.setWorldPosition(this._tempPos2);
                        if (twiceJump) {
                            this._tempPos2.set(item.node.position);
                            this._tempPos2.x += randomRange(1, 2);
                            this._tempPos2.z += randomRange(-1, 1);
                            const parabola = ParabolaTween.moveNodeParabola(item.node, this._tempPos2, 2, 0.5, -1, 360, false);
                            parabola.addPath(this._tempPos, this.itemParabolaHeight, 0.5, -1, 0);
                        } else
                            ParabolaTween.moveNodeParabola(item.node, this._tempPos, this.itemParabolaHeight, 0.5, -1, 0, false);
                    } else {
                        item.node.setPosition(this._tempPos);
                        item.scaleEffect(randomRange(0.2, 0.4));
                    }   


                    if (item.type == 0 && this.money)
                        this.money.addMoney(item.price);
                    else if (this.itemSound.length > 0)
                        SoundMgr.playSound(this.itemSound);
                }

                this.showSlogan(false);

                this.adjustBackPos();
            } else {
                if (orgItem != item) {
                    item.node.removeFromParent();
                    item.node.destroy();
                }

                if (this.emptyYourHand && !this.emptyYourHand.active) {
                    this.emptyYourHand.active = true;

                    tween(this.emptyYourHand)
                    .to(0.75, {scale:v3(1.5, 1.5, 1.5)})
                    .to(0.75, {scale:Vec3.ONE})
                    // .union()
                    // .repeat(3)
                    .call(()=>{
                        this.emptyYourHand.active = false;
                    })
                    .start();
                }
            }
        }

        return ret;
    }

    protected sleepMove(sleepMilliseconds:number):void {
        this._sleepMoveTimer = sys.now();
        this._sleepMoveInterval = sleepMilliseconds;
    }

    protected isSleeping() : boolean {
        if (this._sleepMoveTimer > 0) {
            if (sys.now() >= this._sleepMoveTimer + this._sleepMoveInterval) {
                this._sleepMoveTimer = 0;
            }
        }

        return this._sleepMoveTimer > 0;
    }
    
    protected canMove(movementInput:Vec3, deltaTime:number) : boolean {
        let ret = super.canMove(movementInput, deltaTime);
        if (ret) {
            this._idleFirePackshotTimer = 0;

            if (this.assistant && this.assistant.active) {
                ret = false;
                if (this.packshotMgr)
                    this.packshotMgr.active = true;
            } else if (this._cameraTutorWaitFlag && this._cameraTutorWaitDelay > 0) {
                this.scheduleOnce(()=>{
                    this._cameraTutorWaitFlag = false;
                    this._cameraTutorFlag = true;
                }, this._cameraTutorWaitDelay);

                this._cameraTutorWaitDelay = 0;
            } else if (!this._cameraTutorFlag && !this._cameraTutorWaitFlag && !this._cameraTutorReturnFlag) {
                ret = this._moving;

                if (this._sleepMoveTimer > 0){
                    if (sys.now() < this._sleepMoveTimer + this._sleepMoveInterval)
                        ret = false;
                    else
                        this._sleepMoveTimer = 0;
                }
            } else {
                ret = false;
            }
        } else {
            if (this.idleFirePackshotTime > 0) {
                this._idleFirePackshotTimer += deltaTime;
                if (this._idleFirePackshotTimer > this.idleFirePackshotTime) {
                    if (this.packshotMgr)
                        this.packshotMgr.active = true;
                    this.idleFirePackshotTime = 0;
                }
            }
        }

        return ret;
    }

    public adjustTutorArrow(tutorialDirection:Vec3, deltaTime:number) {
        if (this.tutorArrow) {
            if (tutorialDirection) {
                this.tutorArrow.active = true;
                if (!Vec3.equals(tutorialDirection, Vec3.ZERO)) {
                    this.faceView(tutorialDirection, deltaTime, this.tutorArrow, 0);
                }
            } else
                this.tutorArrow.active = false;
        }
    }

    public setTutorTargetPos(pos:Vec3, delay:number) {
        this._cameraTutorPos.set(pos);

        this._cameraTutorWaitFlag = true;
        this._cameraTutorFlag = false;
        this._cameraTutorReturnFlag = false;

        this._cameraTutorWaitDelay = delay;
        if (delay == 0) {
            this._cameraTutorWaitFlag = false;
            this._cameraTutorFlag = true;
        }

        this._cameraTutorTimer = 0;

        this._idleFirePackshotTimer = 0;

        this.node.getWorldPosition(this._tempPos);
        this._tempPos.subtract(this._cameraTutorPos);
        this._cameraTutorSpeed = this._tempPos.length();
        this._cameraTutorTime = 1;
    }

    protected getCameraFollowPosition(out:Vec3) {
        if (this._cameraTutorFlag) {
            out.set(this._cameraTutorPos);

            return;
        }

        return super.getCameraFollowPosition(out);
    }
    
    protected adjustCameraPosition(deltaTime:number) : boolean {
        const ret = super.adjustCameraPosition(deltaTime);

        if (this._cameraTutorReturnFlag) {
            if (ret) {
                this._cameraTutorReturnFlag = false;
                this._idleFirePackshotTimer = 0;
            }
        }
        
        if (this._cameraTutorFlag) {
            if (ret) {
                this._cameraTutorTimer += deltaTime;
                if (this._cameraTutorTimer > 1) {
                    this._cameraTutorFlag = false;
                    this._cameraTutorReturnFlag = true;
                }
            }
        }

        return ret;
    }

    protected calcNextCameraFollowPosition(ioCur:Vec3, dest:Vec3, deltaTime:number) {
        if (this._cameraTutorFlag || this._cameraTutorReturnFlag) {
            const cameraFollowDelta = (this._cameraTutorSpeed > 0 ? this._cameraTutorSpeed : 5) * deltaTime;

            this._tempPos.set(dest);
            this._tempPos.subtract(ioCur);
            if (this._tempPos.length() <= cameraFollowDelta) {
                ioCur.set(dest);
            } else {
                this._tempPos.normalize();
                this._tempPos.multiplyScalar(cameraFollowDelta);
                ioCur.add(this._tempPos);
            }
        } else
            super.calcNextCameraFollowPosition(ioCur, dest, deltaTime);
    }

    // protected moveTo(targetPos:Vec3) {
    //     this.topAnimation(true);

    //     this._targetPos.set(targetPos);
    //     this._targetPos.y = 0;

    //     this._moving = true;
    // }

    protected topAnimation(start:boolean) {
        if (this.topGroup) {
            Tween.stopAllByTarget(this.topGroup);
            this.topGroup.setPosition(Vec3.ZERO);
    
            if (start)
                tween(this.topGroup)
                .to(this.topAnimationTime, {position:this._topAnimPos})
                .to(this.topAnimationTime, {position:Vec3.ZERO})
                .union()
                .repeatForever()
                .start();
        }
    }

    public getMoney() :number {
        return this.money.getMoney();
    }

    public hasItem(type:number) : boolean {
        if (this.placePos && this.placePos.children.length) {
            const firstItem = this.placePos.children[0].getComponent(Item);
            return (firstItem && firstItem.type == type);
        }
        if (this.milkPos && this.milkPos.children.length) {
            const firstItem = this.milkPos.children[0].getComponent(Item);
            return (firstItem && firstItem.type == type);
        }

        return false;
    }

    public fetchItem(itemType:number) : Item {
        if (this.placePos && this.placePos.children.length) {
            const item = this.placePos.children[this.placePos.children.length - 1].getComponent(Item);
            if (item.isType(itemType))
                return item;
        }
        if (this.milkPos && this.milkPos.children.length) {
            const item = this.milkPos.children[this.milkPos.children.length - 1].getComponent(Item);
            if (item.isType(itemType))
                return item;
        }

        return null;
    }

    public hasMoney() : boolean {
        if (this.moneyPos)
            return this.moneyPos.children.length > 0;

        const item = this.fetchItem(ItemType.NONE);
        return (item && item.type == 0);
    }

    public payOnce(target:Node) : number {
        const placePos = this.moneyPos ? this.moneyPos : this.placePos;

        if (target && placePos && placePos.children.length) {
            const firstItem = placePos.children[0].getComponent(Item);
            if (firstItem && firstItem.type == 0) {
                const unit = placePos.children[0].getComponent(Item).price;
                if (this.money)
                    this.money.addMoney(-unit);

                const element = placePos.children[placePos.children.length - 1];
                element.getWorldPosition(this._tempPos);
                element.setParent(target.parent);// ??? target
                element.setWorldPosition(this._tempPos);
                ParabolaTween.moveNodeParabola(element, Vec3.ZERO, 4, 0.5, -1, 360);

                if (this.itemSound.length)
                    SoundMgr.playSound(this.itemSound);

                this.adjustBackPos();

                return unit;
            }
        }

        return 0;
    }

    protected adjustBackPos() {
        if (this.moneyPos && this.moneyPos.children.length > 0) {
            this.moneyPos.getPosition(this._tempPos);
            this._tempPos.z = -0.4;
            this.moneyPos.setPosition(this._tempPos);

            if (this.milkPos && this.milkPos.children.length > 0) {
                this.milkPos.getPosition(this._tempPos);
                this._tempPos.z = -0.7;
                this.milkPos.setPosition(this._tempPos);
            }
        } else if (this.milkPos && this.milkPos.children.length > 0) {
            this.milkPos.getPosition(this._tempPos);
            this._tempPos.z = -0.4;
            this.milkPos.setPosition(this._tempPos);
        }
    }

    protected calcMoveInput(endPos:Vec3){
        if (endPos){
            this._moveInput.set(endPos);
            this._moveInput.subtract(this.node.position);
            this._moveInput.normalize();
        }else{
            this._moveInput.set(Vec3.ZERO);
        }

        return this._moveInput;
    }

    protected fetchMovementInput() : Vec3{
        return this.isBot() ? this._moveInput : super.fetchMovementInput();
    }

    update(deltaTime: number) {
        if (this.isBot()) {
            this._moveInput.set(Vec3.ZERO);

            switch (this._state) {
                case PlayerController.State.TO_IN:
                    if (this.inputZone && !this._followAnimalCaring) {
                        if (this.hay && this.hay.active) {
                            if (!this.findNearstAnimalPos(this._tempPos))
                                break;
                        } else
                            this.inputZone.getWorldPosition(this._tempPos);

                        this.calcMoveInput(this._tempPos);
                    }
                    break;
                case PlayerController.State.TO_OUT:
                    if (this.placePos && this.placePos.children.length == 0 && this.inputZone) {
                        this._state = PlayerController.State.TO_IN;
                        this._moving = true;
                    } else if (this.outputZone)
                        this.calcMoveInput(this.outputZone.getWorldPosition(this._tempPos));
                    break;
            }
        } else {
            if (this._followAnimals.length > 0 || this._needUpdateRenderTexture)
                this.drawRenderGraphics();
        }

        super.update(deltaTime);
    }

    protected adjustStatus() {
        if (this.hay)
            this.hay.active = this.node.position.z < this.hayShowZ 
                                && (this.isBot() || this.placePos.children.length == 0);

        if (this.placePos)
            this.setAnimationValue('Heavy', (this.hay && this.hay.active) ||
                (this.placePos.parent == this.node && this.placePos.children.length > 0));
    }
    
    protected setAnimationSpeed(speed:number){
        super.setAnimationSpeed(speed);

        if (this.audio) {
            if (speed == 0 || SoundMgr.getPref(false) == 0) {
                if (this.audio.playing)
                    this.audio.stop();
            } else {
                if (!this.audio.playing)
                    this.audio.play();
            }
        }
    }

    protected lateUpdate(dt: number): void {
        if (super.lateUpdate)
            super.lateUpdate(dt);

        this.onFollowAnimals();

        this.adjustStatus();
        // this.updateGroundVfx();
    }

    protected showSlogan(show:boolean, force:boolean=false) {
        if (this.sloganContainer && (this.sloganContainer.active != show || force)) {
            this.sloganContainer.active = show;
    
            if (this.sloganLabel) {
                if (show) {
                    tween(this.sloganLabel)
                    .to(0.5, {scale:v3(1.1, 1.1, 1)})
                    .to(0.5, {scale:Vec3.ONE})
                    .union()
                    .repeatForever()
                    .start();
                } else {
                    Tween.stopAllByTarget(this.sloganLabel)
                }
            }

            this.showUiNodes.forEach(node => {
                node.active = !show;
            });
        }
    }

    public drawRenderGraphics() {
        if (this.renderGraphics) {
            this.renderGraphics.clear();

            const radius:number = 0.65;
            const zoomRadius:number = 256;
            this.node.getWorldPosition(this._tempPos);
            const limitDistance:number = this.groundVfx.node.scale.x / 2 - radius;
/*            
            let maxDistance: number = 0;
            this._followAnimals.forEach(animal => {
                if (animal) {
                    animal.node.getWorldPosition(this._tempPos2);
                    this._tempPos2.subtract(this._tempPos);

                    const distance = this._tempPos2.length();
                    if (distance > maxDistance && distance < limitDistance)
                        maxDistance = distance;
                }
            });
            maxDistance += radius;

            // this._renderTextureScale.set(Vec3.ONE);
            this._renderTextureScale.x = maxDistance * 2;
            this._renderTextureScale.y = maxDistance * 2;
            // this.groundVfx.node.setScale(this._renderTextureScale);
*/

            let drawScale:number = zoomRadius / (this.groundVfx.node.scale.x / 2);//maxDistance;
            const circleRadius:number = drawScale * radius;
            const inRadius:number = circleRadius * 0.9;

            this.renderGraphics.fillColor = Color.WHITE;
            this.renderGraphics.circle(0, 0, circleRadius);

            this._followAnimals.forEach(animal => {
                if (animal) {
                    animal.node.getWorldPosition(this._tempPos2);
                    this._tempPos2.subtract(this._tempPos);
                    const distance = this._tempPos2.length();
                    if (distance < limitDistance) {
                        this._tempPos2.multiplyScalar(drawScale);
                        this.renderGraphics.circle(this._tempPos2.x, this._tempPos2.z, circleRadius);
                    }
                }
            });

            this.renderGraphics.fill();

            this.renderGraphics.fillColor = Color.BLACK;
            this.renderGraphics.circle(0, 0, inRadius);

            this._followAnimals.forEach(animal => {
                if (animal) {
                    animal.node.getWorldPosition(this._tempPos2);
                    this._tempPos2.subtract(this._tempPos);
                    const distance = this._tempPos2.length();
                    if (distance < limitDistance) {
                        this._tempPos2.multiplyScalar(drawScale);
                        this.renderGraphics.circle(this._tempPos2.x, this._tempPos2.z, inRadius);
                    }
                }
            });

            this.renderGraphics.fill();

            this._needUpdateRenderTexture = false;

            this.groundVfx.node.setWorldRotationFromEuler(-90, 0, 0);
        }
    }

    public canFollowable() {
        return this.isBot() || !this.placePos || this.placePos.children.length == 0;
    }

    public canFollowed() {
        return this._followWeight < 1 && this.canFollowable();
    }
    
    protected registerFollowAnimal(animal:AnimalController) : boolean {
        if (animal) {
            if (this._followAnimals.indexOf(animal) < 0) {
                if (this._followAnimals.length == 0)
                    this.playGroundVfxAnim(true);

                this._followAnimals.push(animal);
                this._followWeight += animal.followWeight;
                // console.log(this._followAnimals.length);

                // if (this.itemSound.length)
                //     SoundMgr.playSound(this.itemSound);

                return true;
            }
        }

        return false;
    }

    public isFollowing() : boolean {
        return this._followAnimals.length > 0;
    }

    protected onFollowAnimals() : boolean {
        this._followAnimalCaring = false;

        let ret:boolean = this._followAnimals.length > 0;

        if (this._followAnimals.length > 0) {
            if (!this._followAnimals[this._followAnimals.length - 1])
                this._followAnimals.pop();
        }
        if (this._followAnimals.length > 0) {
            if (!this._followAnimals[0])
                this._followAnimals.shift();
        }

        if (ret && this._followAnimals.length == 0)
            this.playGroundVfxAnim(false);

        for (let index = this._followAnimals.length - 1; index >= 0 ; index--) {
            const animal = this._followAnimals[index];
            if (animal) {
                if (animal.onFollowing(this.node)) {
                    if (this.placePos) {
                        const good = animal.fetchProduct();
                        if (good) {
                            if (this.catchItem(good.getComponent(Item), true)) {

                            } else {
                                animal.throwProduct(good);
                                // animal.unfollow();

                                // this._followAnimals[index] = null;
                                // this._followWeight -= animal.followWeight;
                            }
                        }
                    }

                    if (!animal.isMoving()) {
                        this._followAnimalCaring = true;
                    }
                } else {
                    this._followWeight -= animal.followWeight;

                    this._followAnimals[index] = null;//???this._followAnimals.slice(index, index);
                    // if (this.itemSound.length)
                    //     SoundMgr.playSound(this.itemSound);
                    // console.log('-', this._followWeight);
                }
            }
        }

        // this._moving = false;

        return ret;
    }

    public findNearstAnimal() : Node {
        let animal :Node = null;

        if (this.inputZone) {
            let minDistance:number = Infinity;
            this.node.getWorldPosition(this._tempPos2);

            this.inputZone.children.forEach(node => {
                if (node.getComponent(AnimalController).needFollow()) {
                    node.getWorldPosition(this._tempPos3);
                    const distance = Vec3.squaredDistance(this._tempPos3, this._tempPos2);
                    if (distance < minDistance) {
                        minDistance = distance;
                        animal = node;
                    }
                }
            });
        }

        return animal;
    }

    public findNearstAnimalPos(io:Vec3) : boolean {
        const animal = this.findNearstAnimal();
        if (animal) {
            animal.getWorldPosition(io);
            return true;
        }

        return false;
    }

    protected playGroundVfxAnim(forward:boolean) {
        if (this.groundVfxAnim) {
            this.groundVfxAnim.stop();
            this.groundVfxAnim.play(this.groundVfxAnim.clips[forward ? 0 : 1].name);
        }
    }

}
