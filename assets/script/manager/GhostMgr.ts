import { _decorator, Component, instantiate, Node, Prefab, randomRange, randomRangeInt, Vec3 } from 'cc';
import { SoundMgr } from '../library/manager/SoundMgr';
import { GhostController } from '../controller/GhostController';
import { Utils } from '../library/util/Utils';
import { LevelUpController } from '../controller/LevelUpController';
const { ccclass, property } = _decorator;

@ccclass('GhostMgr')
export class GhostMgr extends Component {
    @property(Prefab)
    ghostPrefabs:Prefab[] = [];

    @property(Node)
    placePos:Node = null;

    @property(Node)
    productPos:Node = null;

    @property
    totalCount:number = 30;

    @property(LevelUpController)
    levelUp:LevelUpController = null;

    protected _timer:number = 0;

    protected _placeOrigins:Vec3[] = [];
    protected _placeHalfDimensions:Vec3[] = [];

    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _tempPos2:Vec3 = Vec3.ZERO.clone();
    protected _direction:Vec3 = Vec3.ZERO.clone();

    protected _foodWaiters:Node[] = [];

    start() {
        while (this.placePos.children.length > 0) {
            this._placeOrigins.push(this.placePos.children[0].getPosition());
            this._placeHalfDimensions.push(Utils.calcArrangeDimension(this.placePos));
        }
    }

    protected lateUpdate(dt: number): void {
        if (SoundMgr.DidFirstClick()) {
            this._timer += dt;
            if (this._timer > 5) {
                this._timer = 0;

                if (this.placePos.children.length < this.totalCount) {
                    const ghost = instantiate(this.ghostPrefabs[randomRangeInt(0, this.ghostPrefabs.length)]);
                    const controller = ghost.getComponent(GhostController);

                    controller.levelUp = this.levelUp;
                    controller.productPos = this.productPos;

                    let placeIndex:number = 0;
                    while(true) {
                        placeIndex = randomRangeInt(0, Math.floor(this._placeHalfDimensions.length / 2)) * 2;
                        this._tempPos.x = randomRange(-this._placeHalfDimensions[placeIndex].x, this._placeHalfDimensions[placeIndex].x) + this._placeOrigins[placeIndex].x;
                        this._tempPos.z = randomRange(-this._placeHalfDimensions[placeIndex].z, this._placeHalfDimensions[placeIndex].z) + this._placeOrigins[placeIndex].z;
                        this._tempPos.y = 0;
    
                        let closure:boolean = false;
                        for (let index = 0; index < this.placePos.children.length; index++) {
                            const element = this.placePos.children[index];
                            const controller = element.getComponent(GhostController);
                            if (Vec3.distance(controller.startPos, this._tempPos) < 1) {
                                closure = true;
                                break;
                            }
                        }
    
                        if (!closure)
                            break;
                    }
    
                    this.placePos.addChild(ghost);
                    this._foodWaiters.push(null);
                    
                    ghost.setWorldPosition(this._tempPos);
    
                    controller.startPos.set(this._tempPos);
    
                    placeIndex ++;
    
                    for (let index = 0; index < 30; index++) {
                        this._tempPos.x = randomRange(-this._placeHalfDimensions[placeIndex].x, this._placeHalfDimensions[placeIndex].x) + this._placeOrigins[placeIndex].x;
                        this._tempPos.z = randomRange(-this._placeHalfDimensions[placeIndex].z, this._placeHalfDimensions[placeIndex].z) + this._placeOrigins[placeIndex].z;
                        this._tempPos.y = 0;
    
                        let closure:boolean = false;
                        for (let index = 0; index < this.placePos.children.length; index++) {
                            const element = this.placePos.children[index];
                            const controller = element.getComponent(GhostController);
                            if (Vec3.distance(controller.startPos, this._tempPos) < 1) {
                                closure = true;
                                break;
                            }
                        }
    
                        if (!closure)
                            break;
                    }
    
                    controller.endPos.set(this._tempPos);
                }
            }
        }
        
    }


    public findNearstWait(node:Node, ioPos:Vec3) : Node {
        let minDistance = Infinity;
        let nearFood:Node = null;
        let nearIndex:number = -1;

        node.getWorldPosition(this._tempPos);
        this._tempPos.y = 0;
        ioPos.set(this._tempPos);

        for (let index = 0; index < this.placePos.children.length; index++) {
            const element = this.placePos.children[index];
            if (element.getComponent(GhostController).isWaiting()) {
                if (!this._foodWaiters[index] || this._foodWaiters[index] == node) {
                    element.getWorldPosition(this._tempPos2);
                    
                    this._tempPos2.y = 0;

                    Vec3.subtract(this._direction, this._tempPos2, this._tempPos);

                    const length = this._direction.length() - 1.5;
                    this._direction.normalize();
                    this._direction.multiplyScalar(length);
                    Vec3.add(this._tempPos2, this._tempPos, this._direction);

                    const distance = Vec3.distance(this._tempPos, this._tempPos2);
    
                    if (distance < minDistance) {
                        ioPos.set(this._tempPos2);
                        minDistance = distance;
    
                        nearFood = element;
                        nearIndex = index;
                    }
                }
            } else
                this._foodWaiters[index] = null;
        }

        if (nearFood)
            this._foodWaiters[nearIndex] = node;

        if (minDistance < 1) {
            this._foodWaiters[nearIndex] = null;
            return nearFood;
        }

        return null;
    }

    public findNearst(node:Node) : Node {
        let minDistance = Infinity;
        let nearGhost:Node = null;

        node.getWorldPosition(this._tempPos);
        this._tempPos.y = 0;

        for (let index = 0; index < this.placePos.children.length; index++) {
            const ghost = this.placePos.children[index].getComponent(GhostController);
            if (ghost && !ghost.hasFood()) {
                ghost.node.getWorldPosition(this._tempPos2);
                
                this._tempPos2.y = 0;

                const distance = Vec3.distance(this._tempPos, this._tempPos2);

                if (distance < minDistance) {
                    minDistance = distance;

                    nearGhost = ghost.node;
                }
            }
        }

        return nearGhost;
    }
}


