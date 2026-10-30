<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">UPDATE DATA PENGGUNA</h3>
                        </div>
                        <div class="card-body">
                            <form action="<?= site_url('Administrator/UbahAdmin') ?>" method="post">
                                <table class="table table-stripped">
                                    <tr>
                                        <td width="150px">Nama Lengkap</td>
                                        <td><input type="text" name="nama" class="form-control" value="<?= $user['nama'] ?>"></td>
                                    </tr>

                                    <tr>
                                        <td>Username</td>
                                        <td>
                                            <input type="text" name="username" class="form-control" value="<?= $user['username'] ?>">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Ubah Password</td>
                                        <td>
                                            <input type="text" name="password" class="form-control" value="<?= $user['confirm'] ?>">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Level</td>
                                        <td>
                                            <select name="log_admin" class="form-control">
                                                <option value="<?= $user['log_admin'] ?>">
                                                    <?php
                                                    $rule = $user['log_admin'];
                                                    if ($rule == 1) {
                                                        echo "Aktif";
                                                    } else {
                                                        echo "Tidak Aktif";
                                                    }
                                                    ?>
                                                </option>
                                                <option value="1">Aktif</option>
                                                <option value="0">Tidak Aktif</option>
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colspan="2">
                                            <input type="hidden" name="id_admin" class="form-control" value="<?= $user['id_admin'] ?>">
                                            <button class="btn btn-danger"><i class="fas fa-retry"></i> Update Data</button>
                                            <a href="<?= site_url('Administrator/kontrol_panel') ?>" class="btn btn-primary" id="tblback"><i class="fas fa-reply"></i> Kembali</a>
                                        </td>
                                    </tr>
                                </table>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>