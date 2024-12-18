import { _decorator, Component, Node, ParticleSystem, RigidBody, tween, Tween, Vec3 } from 'cc';
import { SoundMgr } from '../library/manager/SoundMgr';
const { ccclass, property } = _decorator;

@ccclass('FenceController')
export class FenceController extends Component {
    @property(Node)
    body:Node = null;

    @property(ParticleSystem)
    vfxConstruct:ParticleSystem = null;

    @property(ParticleSystem)
    vfxDestruct:ParticleSystem = null;

    protected _constructStep:number = 4;
    protected _constructInterval:number = 0.5;

    protected _constructTimer:number = 0;

    protected _bodyInitY:number = -1.5;

    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _bodyOrgPos:Vec3 = null;

    protected _constructCount:number = 0;

    protected _worker:Node = null;

    protected onLoad(): void {
        if (this.body)
            this._bodyOrgPos = this.body.getPosition();

        this.setDestructPos();
    }

    protected isConstructed() : boolean {
        return this._constructCount == this._constructStep;
    }

    public setWorker(node:Node) {
        this._worker = node;
    }

    public hasWorker() : boolean {
        return this._worker != null;
    }

    public isConstructable() : boolean {
        return !this.hasWorker() && this._constructCount == 0;
    }

    public constructFence() : boolean {
        if (this._constructCount < this._constructStep) {
            if (this.vfxConstruct && this._constructCount == 0)
                this.vfxConstruct.play();

            Tween.stopAllByTarget(this.body);

            this._tempPos.set(this._bodyOrgPos);
            this._tempPos.y = this._bodyInitY * (this._constructStep - this._constructCount) / this._constructStep;
            this.body.setPosition(this._tempPos);

            this._constructCount ++;
            this._tempPos.y = this._bodyInitY * (this._constructStep - this._constructCount) / this._constructStep;

            tween(this.body)
            .to(0.3, {position:this._tempPos})
            .start();

            if (this._constructCount == this._constructStep) {
                if (this.vfxConstruct)
                    this.vfxConstruct.stop();

                return true;
            }
        }

        return false;
    }

    public destructFence() : boolean {
        let ret:boolean = true;
        if (this._constructCount > 0) {
            this._constructCount --;

            if (this._constructCount == 0) {
                this.setDestructPos();
                SoundMgr.playSound('break');
            } else {
                if (this.vfxDestruct) {
                    this.vfxDestruct.play();
                }

                ret = false;
            }
        }

        return ret;
    }

    protected setDestructPos() {
        if (this.body) {
            this._tempPos.set(this._bodyOrgPos);
            this._tempPos.y = this._bodyInitY;
            this.body.setPosition(this._tempPos);
        }
    }
}


