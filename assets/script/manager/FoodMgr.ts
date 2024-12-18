import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FoodMgr')
export class FoodMgr extends Component {
    @property(Node)
    placePos:Node = null;

    @property(Prefab)
    foodPrefab:Prefab = null;

    protected _timer:number = 0;

    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _tempPos2:Vec3 = Vec3.ZERO.clone();

    protected _foodWaiters:Node[] = [];

    start() {
        for (let index = 0; index < this.placePos.children.length; index++) {
            this._foodWaiters.push(null);
        }

        this.createFood(false);
    }

    protected createFood(onlyOne:boolean) {
        for (let index = 0; index < this.placePos.children.length; index++) {
            const element = this.placePos.children[index];
            if (element.children.length == 0) {
                const food = instantiate(this.foodPrefab);
                element.addChild(food);
                if (onlyOne)
                    break;
            }
        }
    }

    protected lateUpdate(dt: number): void {
        let needFood:boolean = false;
        for (let index = 0; index < this.placePos.children.length; index++) {
            const element = this.placePos.children[index];
            if (element.children.length == 0) {
                needFood = true;
                break;
            }
        }

        if (needFood) {
            this._timer += dt;
            if (this._timer > 1.3) {
                this._timer = 0;
    
                this.createFood(true);
            }
        }
    }

    public findNearstFood(node:Node, ioPos:Vec3) : Node {
        let minDistance = Infinity;
        let nearFood:Node = null;
        let nearIndex:number = -1;

        node.getWorldPosition(this._tempPos);
        this._tempPos.y = 0;
        ioPos.set(this._tempPos);

        for (let index = 0; index < this.placePos.children.length; index++) {
            const element = this.placePos.children[index];
            if (element.children.length > 0) {
                if (!this._foodWaiters[index] || this._foodWaiters[index] == node) {
                    const food = element.children[0];
                    food.getWorldPosition(this._tempPos2);
                    // if (element.position.z > 2)
                    //     this._tempPos2.z -= 0.8;
                    // else
                    //     this._tempPos2.x += 0.8;

                    this._tempPos2.y = 0;
                    const distance = Vec3.distance(this._tempPos, this._tempPos2);
    
                    if (distance < minDistance) {
                        this._tempPos2.subtract(this._tempPos);
                        this._tempPos2.normalize();
                        this._tempPos2.multiplyScalar(distance - 0.5);
                        this._tempPos2.add(this._tempPos);

                        ioPos.set(this._tempPos2);
                        minDistance = distance;
    
                        nearFood = food;
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
}


