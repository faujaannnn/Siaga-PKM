<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-3">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">JUMLAH PENGGUNA</h3>
                        </div>
                        <div class="card-body text-center">
                            <label for="Nomor Antrian" style="font-size: 100px"><?= $count; ?></label>
                        </div>
                    </div>
                    <div class="card card-warning">
                        <div class="card-header">
                            <h3 class="card-title">PANEL KONTROL</h3>
                        </div>
                        <div class="card-body">
                            <a class="btn btn-app bg-secondary" href="<?= site_url('Administrator/addUser') ?>">
                                <span class="badge bg-success"><?= $count; ?></span>
                                <i class="fas fa-user-plus"></i> Tambah User
                            </a>
                            <a class="btn btn-app bg-success">
                                <span class="badge bg-purple">0</span>
                                <i class="fas fa-users-cog"></i> Kontrol Level
                            </a>
                            <a class="btn btn-app bg-danger">
                                <span class="badge bg-teal">0</span>
                                <i class="fas fa-inbox"></i> Orders
                            </a>
                            <a class="btn btn-app bg-warning">
                                <span class="badge bg-info">0</span>
                                <i class="fas fa-envelope"></i> Inbox
                            </a>
                            <a class="btn btn-app bg-info">
                                <span class="badge bg-danger">0</span>
                                <i class="fas fa-heart"></i> Likes
                            </a>
                        </div>
                    </div>
                </div>
                <div class="col-md-9">
                    <div class="card card-primary">
                        <div class="card-header">
                            <h6>DAFTAR PENGGUNA</h6>
                        </div>
                        <div class="card-body p-3">
                            <table class="table table-stripped">
                                <thead>
                                    <tr>
                                        <th width="30px" class="text-center">NO</th>
                                        <th>NAMA PENGGUNA</th>
                                        <th>USERNAME</th>
                                        <th>STATUS</th>
                                        <th width="180px" class="text-center">AKSI</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php $no = 1;
                                    foreach ($pengguna as $p) { ?>
                                        <tr>
                                            <td class="text-center"><?= $no; ?></td>
                                            <td><?= $p->nama_admin; ?></td>
                                            <td><?= $p->username; ?></td>
                                            <td>
                                                <?php if ($p->log_admin == 1) {
                                                    echo "Aktif";
                                                } else {
                                                    echo "Tidak Aktif";
                                                } ?>
                                            </td>
                                            <td class="text-center">
                                                <a href="<?= site_url('Administrator/UbahUser/' . $p->id_admin) ?>" class="btn btn-primary"><i class="fas fa-id-card"></i></a>
                                                <a href="<?= site_url('Administrator/DelUser/' . $p->id_admin) ?>" class="btn btn-danger"><i class="fas fa-user-times"></i></a>
                                            </td>
                                        </tr>
                                    <?php $no++;
                                    } ?>
                                </tbody>
                            </table>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>