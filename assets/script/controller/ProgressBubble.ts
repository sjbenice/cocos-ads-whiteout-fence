import { _decorator, Component, MeshRenderer, Node, sys, Tween, tween, v3, Vec3 } from 'cc';
import { Utils } from '../library/util/Utils';
const { ccclass, property } = _decorator;

@ccclass('ProgressBubble')
export class ProgressBubble extends Component {
    @property
    isPlusMode:boolean = true;

    @property(Node)
    bgBlack:Node = null;

    @property(MeshRenderer)
    progressWhite:MeshRenderer = null;

    @property(Node)
    bgWhite:Node = null;

    @property(MeshRenderer)
    progressBlue:MeshRenderer = null;

    @property(Node)
    ball:Node = null;

    @property(Node)
    icon:Node = null;

    @property(Node)
    checkMarkBall:Node = null;

    @property(Node)
    checkMark:Node = null;

    @property
    animY:number = 0;

    protected _count:number = 0;
    protected _index:number = 0;

    protected _autoReturnPlus:boolean = false;
    protected _autoReturnTimer:number = 0;

    protected _orgPos:Vec3 = null;
    protected _orgScale:Vec3 = null;
    protected _animScale:Vec3 = null;

    protected _idleMoveTween:Tween = null;

    public showBubble(show:boolean, delay:number=0) : boolean {
        if (show != this.node.active) {
            if (show) {
                if (this._orgPos)
                    this.node.setPosition(this._orgPos);

                this.showProgress(0);
                this.node.active = true;

                if (delay > 0) {
                    this.node.setScale(this._animScale);
    
                    tween(this.node)
                    .to(delay, {scale:this._orgScale}, {easing:'bounceOut'})
                    .start();
                }
            } else {
                Tween.stopAllByTarget(this.node);

                if (delay == 0)
                    this.node.active = false;
                else
                    this.scheduleOnce(()=>{
                        this.node.active = false;
                    }, delay);                
            }

            return true;
        }

        return false;
    }

    public showMode(isPlusMode:boolean) {
        this.bgBlack.active = isPlusMode;
        this.progressWhite.node.active = isPlusMode;

        this.bgWhite.active = !isPlusMode;
        this.progressBlue.node.active = !isPlusMode;

        this.ball.active = true;
        this.icon.active = true;
        this.checkMark.active = false;
        this.checkMarkBall.active = false;

        this._count = (isPlusMode ? this.progressWhite.materials.length : this.progressBlue.materials.length) - 1;
        this._index = 0;

        this.showProgress(this._index);

        this.isPlusMode = isPlusMode;
    }

    public getTotalSteps() : number {
        return this._count;
    }

    protected onLoad(): void {
        this._orgPos = this.node.getPosition();
        this._orgScale = this.node.getScale();
        this._animScale = this._orgScale.clone();
        this._animScale.multiplyScalar(0.5);
    }
    
    protected start(): void {
        this.showMode(this.isPlusMode);
    }
    
    public addStep(isPlus:boolean, autoReturnTime:number = 0) : boolean {
        if (!this.node.active)
            return false;

        const newIndex = this._index + (isPlus ? 1 : -1);
        if (newIndex >= this._count || newIndex < 0) {
            return true;
        }

        if (newIndex == this._count - 1) {
            if (this.isPlusMode)
                this.showIdleMove(true);
            else {
                this.ball.active = false;
                this.icon.active = false;
                this.checkMark.active = true;
                this.checkMarkBall.active = true;

                const orgScale = this.checkMark.getScale();
                const newScale = orgScale.clone();
                newScale.multiplyScalar(1.5);
                tween(this.checkMark)
                .to(0.05, {scale:newScale})
                .to(0.05, {scale:orgScale})
                .start();
            }
        } else if (newIndex == 1)
            this.showIdleMove(false);

        this.showProgress(newIndex);

        if (autoReturnTime > 0) {
            this._autoReturnTimer = sys.now() + autoReturnTime * 1000;
            this._autoReturnPlus = !isPlus;
        } else if (autoReturnTime == 0)
            this._autoReturnTimer = 0;

        return false;
    }

    protected showProgress(newIndex:number) {
        const meshRenderer = this.isPlusMode ? this.progressWhite : this.progressBlue;
        if (meshRenderer) {
            if (newIndex > this._count - 1)
                newIndex = this._count - 1;
        
            meshRenderer.material = meshRenderer.materials[newIndex + 1];
        }

        this._index = newIndex;
    }

    protected getProgress() : number {
        return this._index;
    }

    protected lateUpdate(dt: number): void {
        if (this._autoReturnTimer != 0 && sys.now() > this._autoReturnTimer) {
            if (this.addStep(this._autoReturnPlus, -1))
                this._autoReturnTimer = 0;
        }
    }

    protected showIdleMove(show:boolean) {
        if (this.animY > 0) {
            if (this._orgPos)
                this.node.setPosition(this._orgPos);

            if (show) {
                if (!this._idleMoveTween)
                    this._idleMoveTween = tween(this.node)
                        .by(1, {position:v3(0, this.animY, 0)})
                        .by(1, {position:v3(0, -this.animY, 0)})
                        .union()
                        .repeatForever();
                
                if (this._idleMoveTween)
                    this._idleMoveTween.start();
            } else {
                if (this._idleMoveTween)
                    this._idleMoveTween.stop();
            }
        }

   }
}


