import { _decorator, Component, instantiate, Node, Prefab, tween, Vec3 } from 'cc';
import { Utils } from '../library/util/Utils';
import { Item } from '../library/controller/Item';
import { ParabolaTween } from '../library/util/ParabolaTween';
const { ccclass, property } = _decorator;

@ccclass('PackerController')
export class PackerController extends Component {
    @property(Node)
    inputPos:Node = null;

    @property(Node)
    packPos:Node = null;

    @property
    maxOutput:number = 4;

    @property(Node)
    outputPos:Node = null;

    @property(Prefab)
    packPrefab:Prefab = null;

    @property(Node)
    box:Node = null;

    protected _rows:number = 2;
    protected _cols:number = 2;

    protected _timer:number = 0;

    protected _tempPos:Vec3 = Vec3.ZERO.clone();

    protected _packDimen:Vec3 = null;

    start() {
        if (this.packPos)
            this._packDimen = Utils.calcArrangeDimension(this.packPos);
    }

    update(deltaTime: number) {
        this._timer += deltaTime;
        if (this._timer >= 0.1) {
            this._timer = 0;

            if (this.inputPos.children.length > 0 && this.packPos.children.length < this._rows * this._cols
                && (this.maxOutput == 0 || this.outputPos.children.length < this.maxOutput)) {
                const good = this.inputPos.children[this.inputPos.children.length - 1];
                good.setScale(Vec3.ONE);

                good.getWorldPosition(this._tempPos);
                good.setParent(this.packPos);
                good.setWorldPosition(this._tempPos);

                Utils.calcArrangePos(this._packDimen, good.getComponent(Item).getHalfDimension(), this.packPos.children.length - 1, this._tempPos);
                ParabolaTween.moveNodeParabola(good, this._tempPos, 2, 0.3, -1, 0, false);

                if (this.packPos.children.length == this._rows * this._cols) {
                    this.scheduleOnce(()=>{
                        Utils.removeChildrenDestroy(this.packPos);
                        const pack = instantiate(this.packPrefab);
                        this.outputPos.addChild(pack);

                        this.packPos.getWorldPosition(this._tempPos);
                        pack.setWorldPosition(this._tempPos);

                        Utils.calcArrangePos(null, pack.getComponent(Item).getHalfDimension(), this.outputPos.children.length - 1, this._tempPos);
                        ParabolaTween.moveNodeParabola(pack, this._tempPos, 2, 0.3, -1, 0, false);
                    }, 0.5);

                    tween(this.box)
                    .to(0.5, {scale:Utils.Vec1p2})
                    .to(0.2, {scale:Vec3.ONE})
                    .start();
                }
            }
        }
    }
}


