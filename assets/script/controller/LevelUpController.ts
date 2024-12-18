import { _decorator, Component, Node, Tween, tween, Vec3, Animation, randomRange, Collider, ITriggerEvent, Material, MeshRenderer } from 'cc';
import { Number3d } from '../library/ui/Number3d';
import { ParabolaTween } from '../library/util/ParabolaTween';
import { Utils } from '../library/util/Utils';
import { SoundMgr } from '../library/manager/SoundMgr';
import { GameState, GameStateMgr } from '../library/GameState';
const { ccclass, property } = _decorator;

@ccclass('LevelUpController')
export class LevelUpController extends Component {
    @property
    isTest:boolean = false;

    @property(Node)
    toggleNodes:Node[] = [];

    @property(Node)
    hideNodes:Node[] = [];

    @property(Node)
    packshotMgr:Node = null;

    @property(Node)
    icon:Node = null;

    @property(Number3d)
    woolCount3d:Number3d = null;

    @property(Number3d)
    woolTotal3d:Number3d = null;

    @property(Number3d)
    moneyCount3d:Number3d = null;

    @property(Number3d)
    moneyTotal3d:Number3d = null;

    @property
    woolCount:number = 12;

    @property
    moneyCount:number = 50;

    @property(Animation)
    endAnim:Animation = null;

    @property(Node)
    placePos:Node = null;

    @property(Node)
    endVfx:Node = null;

    @property(Collider)
    endCollider:Collider = null;

    @property(Material)
    outlineMaterial:Material = null;

    @property(MeshRenderer)
    outline:MeshRenderer = null;

    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _tempPos2:Vec3 = Vec3.ZERO.clone();

    protected _isEnded:boolean = false;
    protected _isLastState:boolean = false;

    protected _lastTimer:number = 0;
    protected _isLastTiming:boolean = false;

    start() {
        if (this.woolTotal3d)
            this.woolTotal3d.setValue(this.woolCount);

        if (this.moneyTotal3d)
            this.moneyTotal3d.setValue(this.moneyCount);

        // if (this.endCollider)
        //     this.endCollider.on('onTriggerEnter', this.onTriggerEnter, this, true);
    }
    
    // protected onDestroy(): void {
    //     if (this.endCollider)
    //         this.endCollider.off('onTriggerEnter', this.onTriggerEnter, this);

    // }

    public receiveGood(good:Node, isProduct:boolean) {
        if (good) {
            good.getWorldPosition(this._tempPos);
            good.setParent(this.placePos);
            good.setWorldPosition(this._tempPos);

            // if (isProduct) {
            //     this._tempPos2.set(good.position);
            //     this._tempPos2.x += randomRange(1, 2);
            //     this._tempPos2.z += randomRange(-1, 1);
    
            //     const parabola = ParabolaTween.moveNodeParabola(good, this._tempPos2, 2, 0.5, -1, 360);
            //     parabola.addPath(this.icon.position, 4, Math.sqrt(good.position.length()) / 3, -1, 360);
            // } else {
                ParabolaTween.moveNodeParabola(good, this.icon.position, 2, 0.5);
            // }

            Tween.stopAllByTarget(this.icon);

            this.icon.setScale(Vec3.ONE);
            tween(this.icon)
            .to(0.1, {scale:Utils.Vec1p2})
            .to(0.1, {scale:Vec3.ONE})
            .start();

            if (!this._isEnded) {
                if (isProduct) {
                    const count = this.moneyCount3d.getValue();
                    if (count < this.moneyCount) {
                        this.moneyCount3d.setValue(count + 1);
                    }
                } else {
                    const count = this.woolCount3d.getValue();
                    if (count < this.woolCount) {
                        this.woolCount3d.setValue(count + 1);
                    }
                }

                SoundMgr.playSound('catch');

                this._isEnded = this.isTest || (this.moneyCount3d.getValue() == this.moneyCount && this.woolCount3d.getValue() == this.woolCount);
                if (this._isEnded) {
                    if (this.endVfx)
                        this.endVfx.active = true;

                    tween(this.node)
                    .to(0.2, {scale:Utils.Vec1p2})
                    .to(0.1, {scale:Vec3.ONE})
                    .start();
                }
            }
        }
    }

    protected showLastState() {
        if (!this._isLastState) {
            GameStateMgr.setState(GameState.END);

            this._isLastState = true;

            if (this.endVfx)
                this.endVfx.active = false;

            if (this.endAnim)
                this.endAnim.play('cameraLast');
    
            this.toggleNodes.forEach(node => {
                node.active = !node.active;
            });
    
            this.hideNodes.forEach(node => {
                node.active = false;
            });
    
            if (this.packshotMgr)
                this.scheduleOnce(() => {
                    this.packshotMgr.active = true;
                }, 3);
        }
    }

    public startLastTiming() {
        this.outline.material = this.outlineMaterial;

        this._isLastTiming = true;
    }

    // onTriggerEnter (event: ITriggerEvent) {
    //     if (event.otherCollider.getGroup() == PHY_GROUP.PLAYER) {
    //         if (event.otherCollider.getComponent(PlayerController)) {
    //             this.getComponent(WorkZone).isBlinkOutline = false;

    //             this.startLastTiming();
    //         }
    //     }
    // }

    protected lateUpdate(dt: number): void {
        if (this._isLastTiming) {
            this._lastTimer += dt;
            if (this._lastTimer > 1) {
                this.showLastState();

                this._lastTimer = 1;
                this._lastTimer = 0;
                this._isLastTiming = false;
            }
    
            this.outlineMaterial.setProperty('progress', this._lastTimer);
        }
    }
}


